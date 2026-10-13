import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Volume2, Square } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { settingsAPI } from '../../api/settings';

// Short privacy notice shown before each applicant's interview (Data Privacy Act of
// 2012, RA 10173). Every statement here must stay true for the system as built:
// audio is transcribed and not stored, the assistant's voice comes from an online
// service, and the browser's speech service is only a backup.
const TEXT = {
  en: {
    title: 'Before we start',
    intro: (office) => `${office} will ask you for the information needed for your Community Tax Certificate (Cedula):`,
    items: [
      'your name, address, birthday and place of birth, sex, civil status and citizenship;',
      'your height, weight, occupation and income.',
    ],
    points: [
      'Your answers are used only to prepare and issue your Cedula, and are kept as an official barangay record.',
      'Only authorized barangay staff can see your information.',
      'Your voice is turned into text by our speech system and the recording is not saved.',
      "The assistant's voice comes from an online voice service, which receives the sentences it reads to you, such as your name when it checks it. If our speech system is down, your browser's speech service may be used instead.",
      'Under the Data Privacy Act of 2012 (RA 10173), you may ask to see or correct your information.',
    ],
    choice: 'You can stop at any time. If you prefer, the staff can fill out a paper form with you instead.',
    agree: 'I agree, start',
    decline: 'I do not agree',
    read: 'Read aloud',
    stop: 'Stop reading',
    declined: 'No problem. Please ask the barangay staff to help you fill out a paper Cedula form.',
    back: 'Back',
    lang: 'Filipino',
  },
  fil: {
    title: 'Bago tayo magsimula',
    intro: (office) => `Hihingin ng ${office} ang impormasyong kailangan para sa iyong Community Tax Certificate (Cedula):`,
    items: [
      'ang iyong pangalan, tirahan, kaarawan at lugar ng kapanganakan, kasarian, civil status at pagkamamamayan;',
      'ang iyong taas, timbang, trabaho at kita.',
    ],
    points: [
      'Gagamitin lamang ang iyong mga sagot para ihanda at ibigay ang iyong Cedula, at itatago bilang opisyal na rekord ng barangay.',
      'Ang mga awtorisadong kawani lamang ng barangay ang makakakita ng iyong impormasyon.',
      'Ginagawang teksto ng aming speech system ang iyong boses at hindi itinatago ang recording.',
      'Ang boses ng assistant ay mula sa isang online na voice service, na tumatanggap ng mga pangungusap na binabasa nito sa iyo, tulad ng iyong pangalan kapag sinusuri ito. Kung hindi gumagana ang aming speech system, maaaring gamitin ang speech service ng browser.',
      'Ayon sa Data Privacy Act of 2012 (RA 10173), maaari mong hilingin na makita o maitama ang iyong impormasyon.',
    ],
    choice: 'Maaari kang tumigil anumang oras. Kung gusto mo, tutulungan ka ng kawani na sumagot sa papel na form.',
    agree: 'Sumasang-ayon ako, magsimula',
    decline: 'Hindi ako sumasang-ayon',
    read: 'Basahin nang malakas',
    stop: 'Itigil ang pagbasa',
    declined: 'Walang problema. Magpatulong sa kawani ng barangay para sumagot sa papel na Cedula form.',
    back: 'Bumalik',
    lang: 'English',
  },
};

/**
 * Privacy notice the applicant agrees to before the interview starts.
 * `speak(text, onEnd)` / `stopSpeaking()` read it aloud for applicants who cannot read well.
 */
const ConsentNotice = ({ open, onAgree, speak, stopSpeaking }) => {
  const [lang, setLang] = useState('en');
  const [declined, setDeclined] = useState(false);
  const [reading, setReading] = useState(false);
  const [office, setOffice] = useState('The barangay');

  useEffect(() => {
    if (!open) return;
    setDeclined(false);
    settingsAPI.get()
      .then(({ data }) => data?.barangay_name && setOffice(data.barangay_name))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;
  const t = TEXT[lang];

  const readAloud = () => {
    if (reading) {
      stopSpeaking?.();
      setReading(false);
      return;
    }
    const all = [t.title, t.intro(office), ...t.items, ...t.points, t.choice].join(' ');
    setReading(true);
    speak?.(all, () => setReading(false));
  };

  const finish = (agreed) => {
    if (reading) stopSpeaking?.();
    setReading(false);
    if (agreed) onAgree();
    else setDeclined(true);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <Card className="w-full max-w-xl p-6 sm:p-8 animate-scale-in my-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 id="consent-title" className="text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            </span>
            {t.title}
          </h2>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'fil' : 'en')}
            className="text-sm font-semibold text-[var(--color-primary)] hover:underline shrink-0 mt-2"
          >
            {t.lang}
          </button>
        </div>

        {declined ? (
          <div className="mt-6">
            <p className="text-lg text-[var(--color-neutral-700)] leading-relaxed">{t.declined}</p>
            <Button size="lg" variant="secondary" className="mt-6 h-12 px-6 text-base" onClick={() => setDeclined(false)}>
              {t.back}
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-5 text-base text-[var(--color-neutral-800)] leading-relaxed">{t.intro(office)}</p>
            <ul className="mt-2 ml-5 list-disc text-base text-[var(--color-neutral-700)] space-y-1">
              {t.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <ul className="mt-4 space-y-2.5">
              {t.points.map((point) => (
                <li key={point} className="flex gap-2.5 text-[15px] text-[var(--color-neutral-700)] leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] shrink-0" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] font-medium text-[var(--color-neutral-800)]">{t.choice}</p>

            <Button variant="ghost" icon={reading ? Square : Volume2} onClick={readAloud} className="mt-5 -ml-2">
              {reading ? t.stop : t.read}
            </Button>
            {/* Two equal columns whose labels may wrap: the Filipino labels are much longer
                than the English ones and must stay inside the card. */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="order-2 sm:order-1 !h-auto min-h-12 py-3 px-4 text-base !whitespace-normal text-center leading-snug"
                onClick={() => finish(false)}
              >
                {t.decline}
              </Button>
              <Button
                size="lg"
                className="order-1 sm:order-2 !h-auto min-h-12 py-3 px-4 text-base !whitespace-normal text-center leading-snug"
                onClick={() => finish(true)}
              >
                {t.agree}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>,
    document.body,
  );
};

export default ConsentNotice;
