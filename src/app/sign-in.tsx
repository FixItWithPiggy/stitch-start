import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { resetPassword, signIn, signUp } from '@/lib/auth';
import { Button, Card, Field, Note, Screen, Stitch, T } from '@/ui/kit';
import { Fonts, Space } from '@/ui/theme';

type Mode = 'signin' | 'signup';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@')) return setError('Enter your email address.');
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else {
        const mustConfirm = await signUp(email, password);
        if (mustConfirm) setInfo('Check your email and tap the link to confirm your account, then sign in here.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    if (!email.includes('@')) return setError('Enter your email above first, then tap "Forgot password".');
    try {
      await resetPassword(email);
      setInfo('We sent a password reset link to your email.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: Space.s, paddingTop: Space.xxl }}>
          <T variant="display">Stitch Start</T>
          <T color="muted">Tell it your machine and your design. It tells you how to set up.</T>
        </View>
        <Stitch />
        <Card>
          <T variant="title">{mode === 'signin' ? 'Sign in' : 'Create your account'}</T>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'password' : 'new-password'}
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            onSubmitEditing={submit}
          />
          {error ? <Note state="bad">{error}</Note> : null}
          {info ? <Note state="ok">{info}</Note> : null}
          <Button label={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Space.m }}>
            <Pressable accessibilityRole="button" onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
              <T color="accent" style={{ fontFamily: Fonts.bodySemi }}>
                {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
              </T>
            </Pressable>
            {mode === 'signin' ? (
              <Pressable accessibilityRole="button" onPress={forgot}>
                <T color="muted">Forgot password</T>
              </Pressable>
            ) : null}
          </View>
        </Card>
        <Link href="/privacy" asChild>
          <Pressable accessibilityRole="link">
            <T variant="small" color="accent">
              Privacy policy
            </T>
          </Pressable>
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
