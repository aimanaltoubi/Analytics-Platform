import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { localClient } from '@/api/localClient';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeReturnTo } from '@/lib/authReturnTo';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [saved, setSaved] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await localClient.auth.register({ email, password });
      setRecoveryKey(result.recovery_key);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={UserPlus} title={recoveryKey ? 'Save your recovery key' : 'Create a local account'}
      subtitle="No cloud account or email verification is needed."
      footer={<Link to="/login" className="text-primary hover:underline">Back to sign in</Link>}>
      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      {recoveryKey ? (
        <div className="space-y-4">
          <p className="text-sm">Store this key somewhere safe outside this computer. It is shown only once and is required if you forget your password. There are no password-reset emails.</p>
          <code className="block break-all rounded border p-3 select-all">{recoveryKey}</code>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I have saved the recovery key.
          </label>
          <Button disabled={!saved} className="w-full" onClick={() => { window.location.href = safeReturnTo(); }}>Open application</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">The first account is the local administrator. Only an administrator can add further accounts.</p>
          <Label htmlFor="email">Email (local account identifier)</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Label htmlFor="password">Password (at least 12 characters)</Label>
          <Input id="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating account...' : 'Create local account'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
