import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Appearance,
  AccessibilityInfo,
  ActivityIndicator,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { Canvas, Fill, Group, Shader, Skia } from '@shopify/react-native-skia';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { QUOTE_CATEGORIES } from './src/constants/quotes';
import { pickDifferentQuote } from './src/utils/quotePicker';
import { THEME_OPTIONS, getValidBooleanPreference, getValidQuoteMode, getValidThemePreference } from './src/utils/preferences';

// Persist user preferences locally without storing personal data.
const STORAGE_KEY = 'quote-theme-preference';
const QUOTE_MODE_STORAGE_KEY = 'quote-mode-preference';
const REDUCE_MOTION_STORAGE_KEY = 'quote-reduced-motion-preference';
const QUOTE_MODES = Object.keys(QUOTE_CATEGORIES).sort((firstMode, secondMode) => {
  return firstMode.localeCompare(secondMode);
});
const DEFAULT_QUOTE_MODE = QUOTE_MODES[0];

// Map internal category keys to short labels that fit the top toolbar.
const QUOTE_MODE_LABELS = {
  aggressive: 'Tough',
  cheesyPickup: 'Cheesy',
  inspirational: 'Inspire',
  jokes: 'Jokes',
  romanticPickup: 'Romance',
  risquePickup: 'Risque',
};
// RevenueCat identifiers are non-secret names; API keys are loaded from env vars only.
const PRO_ENTITLEMENT_ID = 'Random Quote App Pro';
const REMOVE_ADS_PRODUCT_ID = 'remove_ads';
const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  fallback: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
};

const ORB_SIZE = 320;

// Skia shader draws the animated orb behind each quote.
const ORB_SWIRL_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float2 drift;
uniform float seed;

float hash(float2 p) {
  p = fract(p * float2(123.34 + seed, 456.21 + seed));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(float2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = mat2(1.62, 1.18, -1.08, 1.54) * p + float2(7.2, 3.1);
    amplitude *= 0.52;
  }

  return value;
}

half4 main(float2 p) {
  float2 uv = p / resolution;
  float2 center = uv - float2(0.5);
  float radius = length(center);
  float angle = atan(center.y, center.x);
  float slowTime = time * 0.18;

  float2 flow = float2(
    fbm(uv * 2.4 + drift * 0.35 + float2(slowTime, -slowTime * 0.62)),
    fbm(uv * 2.7 - drift * 0.28 + float2(-slowTime * 0.54, slowTime * 0.8))
  );

  float2 warped = uv;
  warped += (flow - 0.5) * 0.34;
  warped += float2(cos(angle * 2.3 + slowTime), sin(angle * 1.8 - slowTime)) * (0.06 + radius * 0.05);

  float cloud = fbm(warped * 4.1 + drift + seed * 0.03);
  float ribbon = sin((angle * 3.0) + cloud * 5.6 + slowTime * 2.2 + radius * 8.5) * 0.5 + 0.5;
  float pearl = fbm(warped * 8.0 - drift * 0.6 + float2(slowTime * 0.3, slowTime * 0.7));
  float shimmer = smoothstep(0.38, 0.9, cloud * 0.55 + ribbon * 0.35 + pearl * 0.25);

  float3 base = float3(0.88, 0.99, 1.0);
  float3 cyan = float3(0.40, 0.86, 0.96);
  float3 rose = float3(0.96, 0.64, 0.92);
  float3 gold = float3(1.0, 0.76, 0.32);
  float3 mint = float3(0.54, 0.95, 0.82);

  float3 color = mix(base, cyan, smoothstep(0.2, 0.85, cloud) * 0.55);
  color = mix(color, rose, smoothstep(0.45, 0.98, ribbon) * 0.26);
  color = mix(color, gold, smoothstep(0.58, 0.95, pearl) * 0.18);
  color = mix(color, mint, smoothstep(0.5, 0.9, flow.x) * 0.22);
  color += shimmer * 0.12;

  float edge = smoothstep(0.52, 0.22, radius);
  color = mix(color * 0.86, color, edge);

  return half4(color, 1.0);
}
`);

export default function App() {
  // Store quote, menu, theme, entitlement, and purchase state for the single screen.
  const [quoteMode, setQuoteMode] = useState(DEFAULT_QUOTE_MODE);
  const [quote, setQuote] = useState('');
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [quoteMenuOpen, setQuoteMenuOpen] = useState(false);
  const [themePreference, setThemePreference] = useState('system');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() ?? 'light');
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [reduceMotionPreference, setReduceMotionPreference] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const [removeAdsModalOpen, setRemoveAdsModalOpen] = useState(false);
  const [revenueCatReady, setRevenueCatReady] = useState(false);
  const [revenueCatOffering, setRevenueCatOffering] = useState(null);
  const [removeAdsPackage, setRemoveAdsPackage] = useState(null);
  const [removeAdsPrice, setRemoveAdsPrice] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState('');

  // Animated values drive quote reveal, idle motion, shake response, and menus.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const themeMenuAnim = useRef(new Animated.Value(0)).current;
  const quoteMenuAnim = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(1)).current;
  const revealDurationRef = useRef(700);
  const orbSeedRef = useRef(Math.random() * 1000);
  const driftRef = useRef({
    x: Math.random() * 10,
    y: Math.random() * 10,
    targetX: Math.random() * 10,
    targetY: Math.random() * 10,
    nextTargetAt: 0,
  });
  const [orbUniforms, setOrbUniforms] = useState({
    time: 0,
    drift: [driftRef.current.x, driftRef.current.y],
    seed: orbSeedRef.current,
  });

  const resolvedTheme = themePreference === 'system' ? systemScheme : themePreference;
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = systemReduceMotion || reduceMotionPreference;

  // Rebuild styles only when the resolved theme changes.
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const quotesForMode = QUOTE_CATEGORIES[quoteMode] ?? QUOTE_CATEGORIES[DEFAULT_QUOTE_MODE];
  const revenueCatApiKey = Platform.select({
    ios: REVENUECAT_API_KEYS.ios,
    android: REVENUECAT_API_KEYS.android,
    default: REVENUECAT_API_KEYS.fallback,
  }) || REVENUECAT_API_KEYS.fallback || '';

  // Convert RevenueCat customer info into a simple ad-removal entitlement flag.
  const updateProFromCustomerInfo = useCallback((customerInfo) => {
    setHasPro(typeof customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID] !== 'undefined');
  }, []);

  const triggerHaptic = useCallback(async (type = 'selection') => {
    try {
      if (type === 'impact') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      await Haptics.selectionAsync();
    } catch {
      // Haptics are best-effort and intentionally optional across platforms.
    }
  }, []);

  // Load the current RevenueCat offering and choose the remove-ads package.
  const loadRemoveAdsPackage = useCallback(async () => {
    const offerings = await Purchases.getOfferings();
    const currentOffering = offerings.current ?? null;
    setRevenueCatOffering(currentOffering);

    const packages = offerings.current?.availablePackages ?? [];
    const nextPackage = packages.find((availablePackage) => {
      return availablePackage.identifier === REMOVE_ADS_PRODUCT_ID || availablePackage.product?.identifier === REMOVE_ADS_PRODUCT_ID;
    }) ?? packages[0];

    setRemoveAdsPackage(nextPackage ?? null);
    setRemoveAdsPrice(nextPackage?.product?.priceString ?? '');
    return nextPackage ?? null;
  }, []);

  // Refresh purchase state from RevenueCat after purchases or restores.
  const refreshCustomerInfo = useCallback(async () => {
    const customerInfo = await Purchases.getCustomerInfo();
    updateProFromCustomerInfo(customerInfo);
    return customerInfo;
  }, [updateProFromCustomerInfo]);

  // Fade the quote in whenever a fresh quote is selected.
  const animateQuoteIn = useCallback(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      revealAnim.setValue(1);
      return;
    }

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, reduceMotion, revealAnim]);

  // Give the quote orb a short wobble after a physical device shake.
  const triggerShakeAnimation = useCallback(() => {
    if (reduceMotion) return;

    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, shakeAnim]);

  // Load a saved theme only when it matches one of the supported options.
  const loadThemePreference = useCallback(async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    setThemePreference(getValidThemePreference(stored));
  }, []);

  // Save theme changes locally and close the picker once a choice is made.
  const saveThemePreference = useCallback(async (nextPreference) => {
    setThemePreference(nextPreference);
    setThemeMenuOpen(false);
    triggerHaptic();
    await AsyncStorage.setItem(STORAGE_KEY, nextPreference);
  }, [triggerHaptic]);

  const loadReduceMotionPreference = useCallback(async () => {
    const stored = await AsyncStorage.getItem(REDUCE_MOTION_STORAGE_KEY);
    setReduceMotionPreference(getValidBooleanPreference(stored));
  }, []);

  const toggleReduceMotionPreference = useCallback(async () => {
    const nextPreference = !reduceMotionPreference;
    setReduceMotionPreference(nextPreference);
    triggerHaptic();
    await AsyncStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(nextPreference));
  }, [reduceMotionPreference, triggerHaptic]);

  const toggleQuoteMenu = useCallback(() => {
    setQuoteMenuOpen((prev) => !prev);
    setThemeMenuOpen(false);
    triggerHaptic();
  }, [triggerHaptic]);

  const toggleThemeMenu = useCallback(() => {
    setThemeMenuOpen((prev) => !prev);
    setQuoteMenuOpen(false);
    triggerHaptic();
  }, [triggerHaptic]);

  // Load the saved quote category only when it still exists in the app.
  const loadQuoteModePreference = useCallback(async () => {
    const stored = await AsyncStorage.getItem(QUOTE_MODE_STORAGE_KEY);
    setQuoteMode(getValidQuoteMode(stored, QUOTE_MODES, DEFAULT_QUOTE_MODE));
  }, []);

  // Change quote category, refresh the displayed quote, and persist the choice.
  const selectQuoteMode = useCallback(async (nextMode) => {
    setQuoteMode(nextMode);
    setQuoteMenuOpen(false);
    revealDurationRef.current = 700;
    revealAnim.setValue(0);
    setQuote((currentQuote) => pickDifferentQuote(QUOTE_CATEGORIES[nextMode], currentQuote));
    triggerHaptic();
    await AsyncStorage.setItem(QUOTE_MODE_STORAGE_KEY, nextMode);
  }, [revealAnim, triggerHaptic]);

  // Pick a different quote and adjust the reveal duration for shake-triggered changes.
  const setNextQuote = useCallback((withShake = false) => {
    revealDurationRef.current = withShake ? 1200 : 620;
    revealAnim.setValue(0);
    setQuote((currentQuote) => pickDifferentQuote(quotesForMode, currentQuote));
    triggerHaptic(withShake ? 'impact' : 'selection');
    if (withShake) triggerShakeAnimation();
  }, [quotesForMode, revealAnim, triggerHaptic, triggerShakeAnimation]);

  // Open the remove-ads flow and lazy-load product details when possible.
  const openRemoveAdsModal = useCallback(async () => {
    setRemoveAdsModalOpen(true);
    setPurchaseMessage(revenueCatApiKey ? '' : 'RevenueCat is not configured yet.');

    if (revenueCatApiKey && revenueCatReady && !removeAdsPackage) {
      try {
        await loadRemoveAdsPackage();
      } catch (error) {
        setPurchaseMessage(error?.message ?? 'Unable to load the remove ads product.');
      }
    }
  }, [loadRemoveAdsPackage, removeAdsPackage, revenueCatApiKey, revenueCatReady]);

  // Present the RevenueCat paywall and update entitlement state afterwards.
  const presentRemoveAdsPaywall = useCallback(async () => {
    if (!revenueCatApiKey) {
      setPurchaseMessage('RevenueCat is not configured.');
      return;
    }

    setPurchaseLoading(true);
    setPurchaseMessage('');

    try {
      let offering = revenueCatOffering;
      if (!offering) {
        await loadRemoveAdsPackage();
        const offerings = await Purchases.getOfferings();
        offering = offerings.current ?? null;
        setRevenueCatOffering(offering);
      }

      if (!offering) {
        setPurchaseMessage('No RevenueCat offering is available for the paywall.');
        return;
      }

      const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
        offering,
        requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
        displayCloseButton: true,
      });

      const customerInfo = await refreshCustomerInfo();

      if (typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined') {
        setRemoveAdsModalOpen(false);
        setPurchaseMessage('');
        return;
      }

      if (paywallResult === PAYWALL_RESULT.CANCELLED || paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
        setPurchaseMessage('');
        return;
      }

      if (paywallResult === PAYWALL_RESULT.ERROR) {
        setPurchaseMessage('Unable to show the RevenueCat paywall.');
        return;
      }

      setPurchaseMessage('Purchase did not activate Random Quote App Pro.');
    } catch (error) {
      if (!error?.userCancelled) {
        setPurchaseMessage(error?.message ?? 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchaseLoading(false);
    }
  }, [loadRemoveAdsPackage, refreshCustomerInfo, revenueCatApiKey, revenueCatOffering]);

  // Open RevenueCat Customer Center for restores and subscription management.
  const openCustomerCenter = useCallback(async () => {
    if (!revenueCatReady) {
      setPurchaseMessage('RevenueCat is not ready yet.');
      return;
    }

    try {
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: ({ customerInfo }) => {
            updateProFromCustomerInfo(customerInfo);
          },
          onRestoreFailed: ({ error }) => {
            setPurchaseMessage(error?.message ?? 'Restore failed.');
          },
          onPromotionalOfferSucceeded: ({ customerInfo }) => {
            updateProFromCustomerInfo(customerInfo);
          },
        },
      });
      await refreshCustomerInfo();
    } catch (error) {
      setPurchaseMessage(error?.message ?? 'Unable to open Customer Center.');
    }
  }, [refreshCustomerInfo, revenueCatReady, updateProFromCustomerInfo]);

  // Sync saved preferences and live system appearance changes.
  useEffect(() => {
    loadThemePreference();
    loadQuoteModePreference();
    loadReduceMotionPreference();
    const appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'light');
    });
    const reduceMotionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);

    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion);

    return () => {
      appearanceSubscription.remove();
      reduceMotionSubscription.remove();
    };
  }, [loadQuoteModePreference, loadReduceMotionPreference, loadThemePreference]);

  // Configure RevenueCat only when a public env-provided API key is available.
  useEffect(() => {
    if (!revenueCatApiKey) {
      setPurchaseMessage('RevenueCat is not configured yet.');
      return undefined;
    }

    let mounted = true;
    const customerInfoListener = (customerInfo) => {
      updateProFromCustomerInfo(customerInfo);
    };

    const configureRevenueCat = async () => {
      try {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
        Purchases.configure({ apiKey: revenueCatApiKey });
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);

        const customerInfo = await refreshCustomerInfo();
        if (!mounted) return;
        await loadRemoveAdsPackage();
        if (mounted) {
          setRevenueCatReady(true);
          setPurchaseMessage('');
        }
      } catch (error) {
        if (mounted) {
          setPurchaseMessage(error?.message ?? 'Unable to connect to RevenueCat.');
        }
      }
    };

    configureRevenueCat();

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, [loadRemoveAdsPackage, refreshCustomerInfo, revenueCatApiKey, updateProFromCustomerInfo]);

  // Animate both opacity and the clearing overlay when the quote changes.
  useEffect(() => {
    if (!quote) {
      fadeAnim.setValue(0);
      revealAnim.setValue(1);
      return;
    }

    animateQuoteIn();
    if (reduceMotion) {
      revealAnim.setValue(1);
      return;
    }

    Animated.timing(revealAnim, {
      toValue: 1,
      duration: revealDurationRef.current,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [quote, animateQuoteIn, fadeAnim, reduceMotion, revealAnim]);

  // Open and close the theme menu with a subtle movement animation.
  useEffect(() => {
    if (reduceMotion) {
      themeMenuAnim.setValue(themeMenuOpen ? 1 : 0);
      return;
    }

    Animated.timing(themeMenuAnim, {
      toValue: themeMenuOpen ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, themeMenuAnim, themeMenuOpen]);

  // Open and close the quote category menu with matching motion.
  useEffect(() => {
    if (reduceMotion) {
      quoteMenuAnim.setValue(quoteMenuOpen ? 1 : 0);
      return;
    }

    Animated.timing(quoteMenuAnim, {
      toValue: quoteMenuOpen ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [quoteMenuAnim, quoteMenuOpen, reduceMotion]);

  // Keep the quote orb gently moving so the screen does not feel static.
  useEffect(() => {
    if (reduceMotion) {
      floatAnim.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim, reduceMotion]);

  // Update shader uniforms on an animation frame for the orb swirl effect.
  useEffect(() => {
    if (reduceMotion) return undefined;

    let frameId;
    let lastFrameAt = 0;
    const startedAt = Date.now();

    const animateOrb = () => {
      const now = Date.now();
      const drift = driftRef.current;

      if (now >= drift.nextTargetAt) {
        drift.targetX = Math.random() * 12 - 6;
        drift.targetY = Math.random() * 12 - 6;
        drift.nextTargetAt = now + 1800 + Math.random() * 3200;
      }

      drift.x += (drift.targetX - drift.x) * 0.012;
      drift.y += (drift.targetY - drift.y) * 0.012;

      if (now - lastFrameAt > 42) {
        lastFrameAt = now;
        setOrbUniforms({
          time: (now - startedAt) / 1000,
          drift: [drift.x, drift.y],
          seed: orbSeedRef.current,
        });
      }

      frameId = requestAnimationFrame(animateOrb);
    };

    frameId = requestAnimationFrame(animateOrb);
    return () => cancelAnimationFrame(frameId);
  }, [reduceMotion]);

  // Listen for device shakes and throttle them to prevent rapid quote changes.
  useEffect(() => {
    let lastShakeTimestamp = 0;
    const threshold = 1.45;
    const minShakeIntervalMs = 1200;

    Accelerometer.setUpdateInterval(220);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const force = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (force > threshold && now - lastShakeTimestamp > minShakeIntervalMs) {
        lastShakeTimestamp = now;
        setNextQuote(true);
      }
    });

    return () => subscription.remove();
  }, [setNextQuote]);

  // Refresh the quote when the app becomes active again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setNextQuote(false);
      }
    });

    return () => subscription.remove();
  }, [setNextQuote]);

  useEffect(() => {
    if (!quote) {
      setNextQuote(false);
    }
  }, [quote, setNextQuote]);

  const quotePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 28 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.6;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dx) > 46) {
        setNextQuote(false);
      }
    },
  }), [setNextQuote]);

  // Combine the idle float and shake wobble into one transform for the quote orb.
  const quoteTransform = [
    {
      translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
    },
    {
      rotate: shakeAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '3deg', '-3deg', '2deg', '0deg'] }),
    },
    {
      translateX: shakeAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 6, -6, 4, 0] }),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.brandContainer}>
          <View style={styles.logoMark}>
            <View style={styles.logoOrb}>
              <Text style={styles.logoQuestion}>?</Text>
            </View>
            <View style={styles.logoBase} />
          </View>
          <Text style={styles.brandText}>Random Quote App</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            style={styles.modeButton}
            accessibilityRole="button"
            accessibilityLabel="Choose quote category"
            accessibilityHint="Opens the quote category menu"
            onPress={toggleQuoteMenu}
          >
            <Text style={styles.modeButtonText}>{QUOTE_MODE_LABELS[quoteMode] ?? quoteMode}</Text>
          </Pressable>
          <Pressable
            style={styles.themeButton}
            accessibilityRole="button"
            accessibilityLabel="Choose theme and motion settings"
            accessibilityHint="Opens the theme and reduced motion menu"
            onPress={toggleThemeMenu}
          >
            <Text style={styles.themeButtonText}>{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</Text>
          </Pressable>
        </View>
        <Animated.View
          pointerEvents={quoteMenuOpen ? 'auto' : 'none'}
          style={[
            styles.quoteMenu,
            {
              opacity: quoteMenuAnim,
              transform: [
                {
                  translateY: quoteMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                },
                {
                  scale: quoteMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
                },
              ],
            },
          ]}
        >
          {QUOTE_MODES.map((mode) => (
            <Pressable
              key={mode}
              style={[styles.menuItem, quoteMode === mode && styles.activeMenuItem]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${QUOTE_MODE_LABELS[mode] ?? mode} quotes`}
              accessibilityState={{ selected: quoteMode === mode }}
              onPress={() => selectQuoteMode(mode)}
            >
              <Text style={[styles.menuItemText, quoteMode === mode && styles.activeMenuItemText]}>
                {QUOTE_MODE_LABELS[mode] ?? mode}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
        <Animated.View
          pointerEvents={themeMenuOpen ? 'auto' : 'none'}
          style={[
            styles.themeMenu,
            {
              opacity: themeMenuAnim,
              transform: [
                {
                  translateY: themeMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                },
                {
                  scale: themeMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
                },
              ],
            },
          ]}
        >
          {THEME_OPTIONS.map((option) => (
            <Pressable
              key={option}
              style={[styles.menuItem, themePreference === option && styles.activeMenuItem]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${option} theme`}
              accessibilityState={{ selected: themePreference === option }}
              onPress={() => saveThemePreference(option)}
            >
              <Text style={[styles.menuItemText, themePreference === option && styles.activeMenuItemText]}>{option}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.menuItem, styles.lastMenuItem]}
            accessibilityRole="switch"
            accessibilityLabel="Reduce motion"
            accessibilityState={{ checked: reduceMotionPreference }}
            onPress={toggleReduceMotionPreference}
          >
            <Text style={styles.menuItemText}>{reduceMotionPreference ? 'motion reduced' : 'full motion'}</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.content}>
        <Animated.View {...quotePanResponder.panHandlers} style={[styles.oracleWrap, { transform: quoteTransform }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={quote ? `Current quote. ${quote}` : 'Show a random quote'}
            accessibilityHint="Tap or swipe to reveal another quote. You can also shake the device."
            onPress={() => setNextQuote(false)}
          >
            <View style={styles.orb}>
              <Canvas pointerEvents="none" style={styles.orbCanvas}>
                <Group>
                  {ORB_SWIRL_SHADER ? (
                    <>
                      <Shader
                        source={ORB_SWIRL_SHADER}
                        uniforms={{
                          resolution: [ORB_SIZE, ORB_SIZE],
                          time: orbUniforms.time,
                          drift: orbUniforms.drift,
                          seed: orbUniforms.seed,
                        }}
                      />
                      <Fill />
                    </>
                  ) : (
                    <Fill color="#E6FAFF" />
                  )}
                </Group>
              </Canvas>
              <View pointerEvents="none" style={styles.orbGlow} />
              {quote ? (
                <View style={styles.quoteWindow}>
                  <Animated.Text
                    maxFontSizeMultiplier={1.35}
                    style={[
                      styles.quoteText,
                      {
                        opacity: Animated.multiply(fadeAnim, revealAnim),
                        transform: [
                          {
                            translateY: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 10, 0] }),
                          },
                          {
                            scale: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.98, 1] }),
                          },
                        ],
                      },
                    ]}
                  >
                    {quote}
                  </Animated.Text>
                </View>
              ) : null}
              <View pointerEvents="none" style={styles.orbShine} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.blurOverlay,
                  {
                    opacity: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 0.7, 0] }),
                  },
                ]}
              />
            </View>
          </Pressable>
          <View pointerEvents="none" style={styles.holder} />
        </Animated.View>
      </View>

      {!hasPro ? (
        <View style={styles.adContainer}>
          <Pressable
            style={styles.removeAdsButton}
            accessibilityRole="button"
            accessibilityLabel="Remove ads"
            accessibilityHint="Opens the optional RevenueCat remove ads flow"
            onPress={openRemoveAdsModal}
          >
            <Text style={styles.removeAdsButtonText}>X</Text>
          </Pressable>
          <BannerAd unitId={TestIds.BANNER} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
        </View>
      ) : (
        <View style={styles.adSpacer} />
      )}

      <Modal
        animationType="fade"
        transparent
        visible={removeAdsModalOpen}
        onRequestClose={() => setRemoveAdsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.removeAdsModal}>
            <Text style={styles.removeAdsTitle}>Remove ads</Text>
            <Text style={styles.removeAdsBody}>
              Unlock Random Quote App Pro and remove banner ads{removeAdsPrice ? ` for ${removeAdsPrice}.` : '.'}
            </Text>
            {purchaseMessage ? <Text style={styles.purchaseMessage}>{purchaseMessage}</Text> : null}
            <View style={styles.removeAdsActions}>
              <Pressable
                style={[styles.modalButton, styles.closeModalButton]}
                disabled={purchaseLoading}
                accessibilityRole="button"
                accessibilityLabel="Close remove ads dialog"
                onPress={() => setRemoveAdsModalOpen(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.purchaseModalButton, purchaseLoading && styles.disabledButton]}
                disabled={purchaseLoading}
                accessibilityRole="button"
                accessibilityLabel="Open remove ads paywall"
                onPress={presentRemoveAdsPaywall}
              >
                {purchaseLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.purchaseModalButtonText}>
                    {removeAdsPrice ? `Remove ads ${removeAdsPrice}` : 'Remove ads'}
                  </Text>
                )}
              </Pressable>
            </View>
            <Pressable
              style={styles.customerCenterButton}
              accessibilityRole="button"
              accessibilityLabel="Manage purchases"
              onPress={openCustomerCenter}
            >
              <Text style={styles.customerCenterButtonText}>Manage purchases</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Centralize theme-aware styling for the app's single-screen layout.
function createStyles(isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#101820' : '#F7FAF8',
      paddingTop: 70,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      zIndex: 10,
    },
    brandContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoMark: {
      width: 38,
      height: 42,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    logoOrb: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#DFF9FF' : '#F1FDFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#FFFFFF' : '#A7E6F1',
      shadowColor: '#38BDF8',
      shadowOpacity: 0.28,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    logoQuestion: {
      color: '#0F172A',
      fontSize: 18,
      fontWeight: '900',
    },
    logoBase: {
      width: 22,
      height: 8,
      marginTop: -2,
      borderBottomWidth: 8,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: isDark ? '#D97706' : '#EA7A2A',
    },
    brandText: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#102027',
      letterSpacing: 0,
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modeButton: {
      minWidth: 76,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      backgroundColor: isDark ? '#1F2A2E' : '#E7EFEA',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#405059' : '#CAD8D0',
    },
    modeButtonText: {
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0,
    },
    themeButton: {
      minWidth: 58,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 10,
      backgroundColor: isDark ? '#1F2A2E' : '#E7EFEA',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#405059' : '#CAD8D0',
    },
    themeButtonText: {
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0,
    },
    quoteMenu: {
      position: 'absolute',
      top: 48,
      right: 68,
      minWidth: 132,
      backgroundColor: isDark ? '#1A2429' : '#FFFFFF',
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    themeMenu: {
      position: 'absolute',
      top: 48,
      right: 0,
      minWidth: 112,
      backgroundColor: isDark ? '#1A2429' : '#FFFFFF',
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    menuItem: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? '#334155' : '#CBD5E1',
    },
    activeMenuItem: {
      backgroundColor: isDark ? 'rgba(94, 234, 212, 0.12)' : 'rgba(20, 184, 166, 0.1)',
    },
    lastMenuItem: {
      borderBottomWidth: 0,
    },
    menuItemText: {
      color: isDark ? '#F1F5F9' : '#0F172A',
      textTransform: 'capitalize',
      fontSize: 15,
      letterSpacing: 0,
    },
    activeMenuItemText: {
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#020617',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 56,
    },
    oracleWrap: {
      width: 320,
      height: 350,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    orb: {
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: isDark ? '#DFF9FF' : '#F1FDFF',
      borderWidth: 2,
      borderColor: isDark ? '#F8FEFF' : '#C7EEF4',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      shadowColor: isDark ? '#67E8F9' : '#38BDF8',
      shadowOpacity: 0.32,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    orbCanvas: {
      ...StyleSheet.absoluteFillObject,
    },
    orbGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.38)',
    },
    quoteWindow: {
      width: 232,
      minHeight: 170,
      borderRadius: 34,
      paddingHorizontal: 20,
      paddingVertical: 22,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(240, 253, 250, 0.52)' : 'rgba(255, 255, 255, 0.48)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(14, 116, 144, 0.2)',
    },
    orbShine: {
      position: 'absolute',
      width: 96,
      height: 42,
      borderRadius: 40,
      top: 54,
      left: 74,
      backgroundColor: 'rgba(255, 255, 255, 0.58)',
      transform: [{ rotate: '-24deg' }],
    },
    holder: {
      position: 'absolute',
      bottom: 4,
      width: 168,
      height: 0,
      borderBottomWidth: 46,
      borderLeftWidth: 34,
      borderRightWidth: 34,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: isDark ? '#D97706' : '#EA7A2A',
      shadowColor: '#7C2D12',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
    },
    blurOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? '#E0FBFF' : '#F8FDFF',
    },
    quoteText: {
      fontSize: 22,
      textAlign: 'center',
      fontWeight: '700',
      lineHeight: 30,
      color: isDark ? '#0F172A' : '#12313A',
      letterSpacing: 0,
    },
    adContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 70,
      marginBottom: 8,
      position: 'relative',
      alignSelf: 'center',
      paddingTop: 10,
    },
    adSpacer: {
      minHeight: 70,
      marginBottom: 8,
    },
    removeAdsButton: {
      position: 'absolute',
      top: 0,
      right: -10,
      zIndex: 2,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#475569' : '#CBD5E1',
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    removeAdsButtonText: {
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontSize: 13,
      fontWeight: '900',
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: 'rgba(15, 23, 42, 0.58)',
    },
    removeAdsModal: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 18,
      padding: 22,
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    removeAdsTitle: {
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 8,
    },
    removeAdsBody: {
      color: isDark ? '#CBD5E1' : '#475569',
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 14,
    },
    purchaseMessage: {
      color: isDark ? '#FDE68A' : '#92400E',
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 14,
    },
    removeAdsActions: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    closeModalButton: {
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    closeModalButtonText: {
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontSize: 15,
      fontWeight: '800',
    },
    purchaseModalButton: {
      backgroundColor: '#EA7A2A',
    },
    purchaseModalButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    customerCenterButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 38,
      marginTop: 12,
    },
    customerCenterButtonText: {
      color: isDark ? '#93C5FD' : '#2563EB',
      fontSize: 14,
      fontWeight: '700',
    },
    disabledButton: {
      opacity: 0.64,
    },
  });
}
