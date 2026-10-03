import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { KeyRound, Lock, X } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { authAPI } from '../../api/auth';
import { getApiErrorMessage } from '../../api/errors';

const MIN_LENGTH = 8;

/** Lets any signed-in staff member change their own password. */
const ChangePasswordDialog = ({ open, onClose }) => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // The header re-renders every minute (clock); keep the latest onClose in a
  // ref so that does not re-run the effect below and wipe what was typed.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    setForm({ current: '', next: '', confirm: '' });
    setErrors({});
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.current) nextErrors.current = 'Enter your current password.';
    if (form.next.length < MIN_LENGTH) nextErrors.next = `Use at least ${MIN_LENGTH} characters.`;
    else if (form.next === form.current) nextErrors.next = 'Choose a password different from the current one.';
    if (form.confirm !== form.next) nextErrors.confirm = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await authAPI.changePassword(form.current, form.next);
      toast.success('Password changed.');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not change the password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-start justify-between gap-3 mb-5">
          <h2 id="change-password-title" className="font-display text-lg font-semibold text-[var(--color-neutral-900)] flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            Change password
          </h2>
          <button type="button" onClick={onClose} className="text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input label="Current password" type="password" icon={Lock} autoComplete="current-password"
            value={form.current} onChange={update('current')} error={errors.current} required />
          <Input label="New password" type="password" icon={Lock} autoComplete="new-password"
            value={form.next} onChange={update('next')} error={errors.next} required />
          <Input label="Confirm new password" type="password" icon={Lock} autoComplete="new-password"
            value={form.confirm} onChange={update('confirm')} error={errors.confirm} required />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} disabled={saving} icon={KeyRound}>
              {saving ? 'Saving…' : 'Change password'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ChangePasswordDialog;
