// Student sign-in: UVA email (required) and optional name. Errors come from the API.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/auth';
import { errorText } from '../src/hooks/useLoad';
import { MIN_TAP, radius, spacing, type, useTheme } from '../src/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim() !== '' && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, name);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Find housing near your classes
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Sign in with your UVA email to see ranked listings, save favorites and get alerts.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]} nativeID="email-label">
            UVA email
          </Text>
          <TextInput
            accessibilityLabelledBy="email-label"
            value={email}
            onChangeText={setEmail}
            placeholder="netid@virginia.edu"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!submitting}
            style={inputStyle}
          />
          <Text style={[styles.hint, { color: colors.muted }]}>UVA email only. Must end in @virginia.edu.</Text>

          <Text style={[styles.label, { color: colors.text }]} nativeID="name-label">
            Name (optional)
          </Text>
          <TextInput
            accessibilityLabelledBy="name-label"
            value={name}
            onChangeText={setName}
            placeholder="First name"
            placeholderTextColor={colors.muted}
            autoComplete="name"
            textContentType="givenName"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!submitting}
            style={inputStyle}
          />

          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Continue"
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
            accessibilityHint="Signs you in with this email"
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.sm, marginTop: spacing.xl },
  title: { fontSize: type.title, fontWeight: '700' },
  body: { fontSize: type.body },
  form: { gap: spacing.sm, marginTop: spacing.lg },
  label: { fontSize: type.body, fontWeight: '600', marginTop: spacing.sm },
  hint: { fontSize: type.small },
  input: {
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  error: { fontSize: type.body, marginTop: spacing.sm },
});
