import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { localClient } from '@/api/localClient';
import AuthLayout from '@/components/AuthLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await localClient.auth.resetPassword({ email, recovery_key: key, newPassword: password });
      setComplete(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={Lock} title="Recover your local account"
      subtitle="Use the recovery key saved when you created this account."
      footer={<Link to="/login" className="text-primary hover:underline">Back to sign in</Link>}>
      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      {complete ? <p>Your password has been reset. Sign in with your new password.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Label htmlFor="key">Recovery key</Label>
          <Input id="key" autoComplete="off" required value={key} onChange={(e) => setKey(e.target.value)} />
          <Label htmlFor="password">New password (at least 12 characters)</Label>
          <Input id="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Resetting...' : 'Reset password'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
