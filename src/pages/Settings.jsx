import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Settings as SettingsIcon, Save, Landmark, SlidersHorizontal, Info } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Settings = () => {
  const [settings, setSettings] = useState({
    barangayName: 'Barangay San Roque',
    municipality: 'Mambajao',
    province: 'Camiguin',
    defaultTax: 5.00,
    qrExpiryMinutes: 60,
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // In production, save settings to backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Error saving settings');
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
          Configure system preferences for barangay information, CTC defaults, and QR handoff timing.
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
                      These details appear across administrative records and printed documents.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <Input
                    label="Barangay Name"
                    name="barangayName"
                    value={settings.barangayName}
                    onChange={handleChange}
                  />
                  <Input
                    label="Municipality"
                    name="municipality"
                    value={settings.municipality}
                    onChange={handleChange}
                  />
                  <Input
                    label="Province"
                    name="province"
                    value={settings.province}
                    onChange={handleChange}
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
                      Set default processing values used by staff workflows.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <Input
                      label="Default Community Tax (PHP)"
                      name="defaultTax"
                      type="number"
                      value={settings.defaultTax}
                      onChange={handleChange}
                    />
                    <p className="text-xs text-[var(--color-neutral-500)] mt-1.5">
                      Applied as the initial community tax amount when processing a CTC.
                    </p>
                  </div>

                  <div>
                    <Input
                      label="QR Code Expiry (minutes)"
                      name="qrExpiryMinutes"
                      type="number"
                      value={settings.qrExpiryMinutes}
                      onChange={handleChange}
                    />
                    <p className="text-xs text-[var(--color-neutral-500)] mt-1.5">
                      Controls how long a citizen QR code remains valid before staff must request a new one.
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
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">{settings.barangayName}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">Location</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">
                    {settings.municipality}, {settings.province}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">Default tax</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">
                    PHP {Number(settings.defaultTax || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[var(--color-neutral-500)]">QR validity</span>
                  <span className="font-semibold text-[var(--color-neutral-800)] text-right">
                    {settings.qrExpiryMinutes || 0} minutes
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
                    Changes affect staff-facing defaults and official location labels used throughout the app.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex justify-end xl:justify-stretch">
              <Button
                type="submit"
                loading={isLoading}
                disabled={isLoading}
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
