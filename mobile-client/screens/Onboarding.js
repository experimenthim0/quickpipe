import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { saveSecureKey } from '../utils/secureStore';
import CONFIG from '../config';

const API_BASE_URL = CONFIG.API_BASE_URL;

export default function Onboarding({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('request'); // 'request' | 'verify'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRequestOtp = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await response.json();
      if (response.ok) {
        setStep('verify');
      } else {
        setErrorMsg(data.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Check connection to API server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      setErrorMsg('Please enter a 6-digit verification code.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim()
        })
      });
      const data = await response.json();
      if (response.ok && data.syncKey) {
        const saved = await saveSecureKey(data.syncKey);
        if (saved) {
          onAuthSuccess(data.syncKey);
        } else {
          setErrorMsg('Failed to securely store pairing key. Try again.');
        }
      } else {
        setErrorMsg(data.error || 'Invalid code or verify failure.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error verifying code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-darkspace"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 justify-center items-center p-6">

          {/* ── Main auth card ── */}
          <View className="w-full max-w-[360px] bg-cardglass rounded-3xl p-6 border border-slate-800/80 items-center">
            {/* App branding */}
             <Image
              source={{ uri: 'https://raw.githubusercontent.com/experimenthim0/quickpipe/main/chrome-extension/icon128.png' }}
              className="w-16 h-16 rounded-xl mb-2"
            />
            <Text className="text-2xl font-bold text-white tracking-tight">QuickPipe</Text>
            <Text className="text-xs text-neutral-300 text-center mt-1.5 mb-6 leading-relaxed">
              Minimalist cross-device link sync pipeline
            </Text>

            {errorMsg ? (
              <Text className="text-red-500 text-xs font-semibold text-center mb-4">{errorMsg}</Text>
            ) : null}

            {step === 'request' ? (
              <View className="w-full">
                <Text className="text-[13px] font-bold text-cyanaccent mb-1.5 uppercase tracking-wider">Email Address</Text>
                <TextInput
                  className="w-full h-12 border border-slate-600 rounded-xl px-4 text-sm text-white bg-slate-950/60 mb-4 focus:border-cyanaccent"
                  placeholder="aaash@nikhim.me"
                  placeholderTextColor="#838d9c"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
                <TouchableOpacity
                  className="w-full h-12 bg-cyanaccent rounded-xl justify-center items-center active:opacity-90"
                  onPress={handleRequestOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#090D16" />
                  ) : (
                    <Text className="text-darkspace text-sm font-bold">Get Magic OTP</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View className="w-full">
                <Text className="text-[10px] font-bold text-cyanaccent mb-1.5 uppercase tracking-wider">6-Digit Verification Code</Text>
                <TextInput
                  className="w-full h-12 border border-slate-800 rounded-xl px-4 text-sm text-cyanaccent bg-slate-950/60 mb-4 tracking-[4px] text-center font-bold focus:border-cyanaccent"
                  placeholder="123456"
                  placeholderTextColor="#838d9c"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus={true}
                  value={code}
                  onChangeText={setCode}
                />
                <TouchableOpacity
                  className="w-full h-12 bg-cyanaccent rounded-xl justify-center items-center active:opacity-90"
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#090D16" />
                  ) : (
                    <Text className="text-darkspace text-sm font-bold">Verify & Connect</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="mt-4 flex-row justify-center items-center p-2"
                  onPress={() => { setStep('request'); setErrorMsg(''); setCode(''); }}
                  disabled={loading}
                >
                  <Feather name="arrow-left" size={14} color="#64748b" />
                  <Text className="text-slatemuted text-xs font-semibold ml-1.5">Edit Email</Text>
                </TouchableOpacity>
                {/* <Text className="text-[10px] text-slatemuted text-center mt-6 leading-relaxed">
                  A security code was printed to the QuickPipe Server logs.
                </Text> */}
              </View>
            )}
          </View>

          {/* ── Developer & OSS footer ── */}
          <View className="w-full max-w-[360px] mt-4 px-1">
            {/* Developer pill */}
            <View className="flex-row items-center justify-between bg-slate-950/60 border border-slate-800/60 rounded-2xl px-4 py-3 mb-2">
              <View className="flex-row items-center">
                <View className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg mr-2.5">
                  <Feather name="code" size={11} color="#00F2FE" />
                </View>
                <View>
                  <Text className="text-[11px] font-bold text-white">Nikhil Yadav</Text>
                  <Text className="text-[9px] text-neutral-300 mt-0.5">Developer & Maintainer</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://nikhim.me')}
                className="flex-row items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 active:bg-slate-800"
              >
                <Feather name="globe" size={10} color="#00F2FE" />
                <Text className="text-[10px] text-cyanaccent font-semibold ml-1">nikhim.me</Text>
              </TouchableOpacity>
            </View>

            {/* Download Extension & OSS pills */}
            <View className="flex-col gap-2 mt-1">
              <TouchableOpacity
                onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe')}
                className="flex-row items-center justify-center bg-slate-950/60 border border-slate-800/60 rounded-2xl px-4 py-2.5 active:bg-slate-900"
              >
                <Feather name="chrome" size={11} color="#00F2FE" />
                <Text className="text-[10px] text-cyanaccent font-bold ml-1.5">Get Chrome Extension from GitHub</Text>
                <View className="w-[1px] h-3 bg-slate-800 mx-2.5" />
                <Feather name="download" size={10} color="#00F2FE" />
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe')}
                className="flex-row items-center justify-center bg-slate-950/60 border border-slate-800/60 rounded-2xl px-4 py-2.5 active:bg-slate-900"
              >
                <Feather name="github" size={11} color="white" />
                <Text className="text-[10px] text-neutral-300 font-semibold ml-1.5">View Source Code on GitHub</Text>
                <View className="w-[1px] h-3 bg-slate-800 mx-2.5" />
                <Feather name="heart" size={10} color="#ef4444" />
                <Text className="text-[10px] text-neutral-300 font-semibold ml-1.5">Free to self-host</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}