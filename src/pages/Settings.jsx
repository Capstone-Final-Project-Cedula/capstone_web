import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Settings as SettingsIcon, Save, Landmark, SlidersHorizontal, Info } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { settingsAPI, SETTINGS_UPDATED_EVENT } from '../api/settings';
import { getApiErrorMessage } from '../api/errors';

const EMPTY = {
  barangay_name: '',
  municipality: '',
  province: '',
  qr_expiry_minutes: 60,
  basic_community_tax: 5,
};

const Settings = () => {
  const [settings, setSettings] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    settingsAPI.get()
      .then((res) => setSettings(res.data))
      .catch((error) => toast.error(getApiErrorMessage(error, 'Could not load settings')))
      .finally(() => setIsFetching(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const qrExpiry = Number(settings.qr_expiry_minutes);
    if (!Number.isInteger(qrExpiry) || qrExpiry < 5 || qrExpiry > 1440) {
      toast.error('QR code expiry must be a whole number from 5 to 1440 minutes.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await settingsAPI.update({
        barangay_name: settings.barangay_name,
        municipality: settings.municipality,
        province: settings.province,
        qr_expiry_minutes: qrExpiry,
      });
      setSettings(res.data);
      window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: res.data }));
      toast.success('Settings saved. New CTCs and QR codes will use them.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving settings'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
            <SettingsIcon className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
          </span>
          Settings
        </h1>
        <p className="text-[var(--color-neutral-500)] mt-2 max-w-3xl">
          Configure barangay information and QR handoff timing. Changes are shared by every computer using the system.
        </p>
      </div>

      <form onSubmit={handleSave} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] gap-6 items-start">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardBody>
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                    <Landmark className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)]">
                      Barangay Information
                    </h2>
                    <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                      Shown in the header and printed on CTCs (place of issue) and receipts.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <Input
                    label="Barangay Name"
                    name="barangay_name"
                    value={settings.barangay_name}
                    onChange={handleChange}
                    disabled={isFetching}
                  />
                  <Input
                    label="Municipality"
                    name="municipality"
                    value={settings.municipality}
                    onChange={handleChange}
                    disabled={isFetching}
                  />
                  <Input
                    label="Province"
                    name="province"
                    value={settings.province}
                    onChange={handleChange}
                    disabled={isFetching}
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-voice-light)] flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-5 h-5 text-[var(--color-voice)]" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)]">
                      System Configuration
                    </h2>
                    <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                      Processing values used by staff workflows.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <Input
                      label="Basic Community Tax (PHP)"
                      name="basic_community_tax"
                      type="number"
                      value={Number(settings.basic_community_tax).toFixed(2)}
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-[var(--color-neutral-500)] mt-1.5">
                      Fixed at PHP 5.00 by RA 7160 (Local Government Code). The additional tax is computed from income.
                    </p>
                  </div>

                  <div>
                    <Input
                      label="QR Code Expiry (minutes)"
                      name="qr_expiry_minutes"
                      type="number"
                      min={5}
                      max={1440}
                      value={settings.qr_expiry_minutes}
                      onChange={handleChange}
                      disabled={isFetching}
                    />
                    <p className="text-xs text-[var(--color-neutral-500)] mt-1.5">
                      How long a citizen's QR code stays valid (5–1440 minutes). Applies to QR codes generated after saving.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-4">
                Current setup
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">Barangay</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">{settings.barangay_name}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">Location</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">
                    {settings.municipality}, {settings.province}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">Basic tax</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">
                    PHP {Number(settings.basic_community_tax || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">QR validity</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">
                    {settings.qr_expiry_minutes || 0} minutes
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-[var(--color-primary-light)] border-[rgba(59,75,196,0.16)]">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-white/80 flex items-center justify-center shrink-0">
                  <Info className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-[var(--color-neutral-800)]">
                    Review before saving
                  </h3>
                  <p className="text-sm text-[var(--color-neutral-600)] mt-1">
                    Changes apply to CTCs and QR codes created afterwards; existing records keep their printed details.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex justify-end xl:justify-stretch">
              <Button
                type="submit"
                loading={isLoading}
                disabled={isLoading || isFetching}
                icon={Save}
                className="w-full sm:w-auto xl:w-full"
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
};

export default Settings;
