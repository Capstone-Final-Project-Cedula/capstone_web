import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Heart, Send } from 'lucide-react';
import Button from '../ui/Button';
import { susAPI } from '../../api/sus';
import { getApiErrorMessage } from '../../api/errors';
import {
  SUS_CONSENT_TEXT, SUS_EXPERIENCE, SUS_FEATURES, SUS_ROLES, SUS_SCALE, SUS_STATEMENTS,
} from '../../constants/sus';

const STEPS = ['consent', 'profile', 'statements', 'comments'];

/** A large tappable choice (radio or checkbox look). */
const Choice = ({ selected, onClick, label, hint, multiple = false }) => (
  <button
    type="button"
    role={multiple ? 'checkbox' : 'radio'}
    aria-checked={selected}
    onClick={onClick}
    className={[
      'focusable w-full min-h-[56px] text-left rounded-[var(--radius-md)] border-2 px-4 py-3 flex items-center gap-3 transition-colors',
      selected
        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
        : 'border-[var(--color-neutral-200)] bg-white hover:border-[var(--color-neutral-300)]',
    ].join(' ')}
  >
    <span
      className={[
        'w-6 h-6 shrink-0 flex items-center justify-center border-2',
        multiple ? 'rounded-md' : 'rounded-full',
        selected ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-neutral-300)]',
      ].join(' ')}
      aria-hidden="true"
    >
      {selected && <Check className="w-4 h-4" />}
    </span>
    <span>
      <span className="block text-base font-semibold text-[var(--color-neutral-800)]">{label}</span>
      {hint && <span className="block text-sm text-[var(--color-neutral-500)]">{hint}</span>}
    </span>
  </button>
);

const SectionTitle = ({ children, help }) => (
  <div className="mb-3">
    <h3 className="text-lg font-semibold text-[var(--color-neutral-900)]">{children}</h3>
    {help && <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">{help}</p>}
  </div>
);

/**
 * The SUS questionnaire: consent → about you → 10 statements → comments → thank you.
 * The score is never shown to the respondent.
 */
const SusSurvey = ({ platform = 'web', transactionId = null, defaultFeatures = [], onClose, closeLabel = 'Done' }) => {
  const [step, setStep] = useState('consent');
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [experience, setExperience] = useState('');
  const [features, setFeatures] = useState(defaultFeatures);
  const [answers, setAnswers] = useState({});
  const [comments, setComments] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const topRef = useRef(null);
  const statementRefs = useRef([]);

  const goTo = (next) => {
    setShowMissing(false);
    setError('');
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFeature = (value) =>
    setFeatures((current) => (current.includes(value) ? current.filter((f) => f !== value) : [...current, value]));

  const missingStatements = SUS_STATEMENTS.map((_, i) => i + 1).filter((q) => !answers[q]);

  const nextFromProfile = () => {
    if (!role || !experience) {
      setShowMissing(true);
      return;
    }
    goTo('statements');
  };

  const nextFromStatements = () => {
    if (missingStatements.length) {
      setShowMissing(true);
      statementRefs.current[missingStatements[0] - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    goTo('comments');
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const ratings = Object.fromEntries(SUS_STATEMENTS.map((_, i) => [`q${i + 1}`, answers[i + 1]]));
      await susAPI.submit({
        respondent_name: name.trim() || null,
        role,
        computer_experience: experience,
        features_used: features,
        ...ratings,
        comments: comments.trim() || null,
        consent_given: true,
        platform,
        transaction_id: transactionId,
      });
      setStep('thanks');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send your answers. Please check the connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'thanks') {
    return (
      <div className="text-center py-6" ref={topRef}>
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)]">
          <Heart className="w-9 h-9" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-neutral-900)]">Thank you!</h2>
        <p className="mt-2 text-lg text-[var(--color-neutral-600)]">
          Your answers were saved. They will help us improve CeduSync.
        </p>
        <Button size="lg" className="mt-8 h-14 px-8 text-base" onClick={onClose}>{closeLabel}</Button>
      </div>
    );
  }

  const stepNumber = STEPS.indexOf(step) + 1;

  return (
    <div ref={topRef} className="scroll-mt-6">
      <p className="text-sm font-medium text-[var(--color-primary)] mb-1">Step {stepNumber} of {STEPS.length}</p>
      <div className="h-1.5 rounded-full bg-[var(--color-neutral-100)] mb-6 overflow-hidden">
        <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${(stepNumber / STEPS.length) * 100}%` }} />
      </div>

      {step === 'consent' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-neutral-900)]">Before we start</h2>
            <p className="mt-3 text-lg text-[var(--color-neutral-700)] leading-relaxed">{SUS_CONSENT_TEXT}</p>
            <p className="mt-2 text-base text-[var(--color-neutral-500)]">
              It takes about 2 minutes. There are no right or wrong answers.
            </p>
          </div>
          <Choice
            multiple
            selected={consent}
            onClick={() => setConsent(!consent)}
            label="I agree to answer this survey"
          />
          <div className="flex flex-wrap gap-3 justify-between">
            <Button variant="secondary" size="lg" className="h-14 px-6 text-base" onClick={onClose}>No, thanks</Button>
            <Button size="lg" className="h-14 px-8 text-base" icon={ArrowRight} iconPosition="right"
              disabled={!consent} onClick={() => goTo('profile')}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 'profile' && (
        <div className="space-y-7">
          <div>
            <SectionTitle help="Optional. You can leave this blank.">Your name</SectionTitle>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
              placeholder="Leave blank to stay anonymous"
              className="focusable w-full h-14 rounded-[var(--radius-md)] border-2 border-[var(--color-neutral-200)] px-4 text-base"
            />
          </div>

          <div role="radiogroup" aria-label="Who are you?">
            <SectionTitle>Who are you?</SectionTitle>
            <div className="grid gap-2.5">
              {SUS_ROLES.map((r) => (
                <Choice key={r.value} selected={role === r.value} onClick={() => setRole(r.value)} label={r.label} hint={r.hint} />
              ))}
            </div>
            {showMissing && !role && <p className="mt-2 text-sm font-medium text-[var(--color-error)]">Please choose one.</p>}
          </div>

          <div role="radiogroup" aria-label="How much do you use computers or phones?">
            <SectionTitle>How much do you use computers or phones?</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {SUS_EXPERIENCE.map((x) => (
                <Choice key={x.value} selected={experience === x.value} onClick={() => setExperience(x.value)} label={x.label} hint={x.hint} />
              ))}
            </div>
            {showMissing && !experience && <p className="mt-2 text-sm font-medium text-[var(--color-error)]">Please choose one.</p>}
          </div>

          <div>
            <SectionTitle help="Tap all that you used today.">Which parts of CeduSync did you use?</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {SUS_FEATURES.map((f) => (
                <Choice key={f.value} multiple selected={features.includes(f.value)} onClick={() => toggleFeature(f.value)} label={f.label} hint={f.hint} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            <Button variant="secondary" size="lg" className="h-14 px-6 text-base" icon={ArrowLeft} onClick={() => goTo('consent')}>Back</Button>
            <Button size="lg" className="h-14 px-8 text-base" icon={ArrowRight} iconPosition="right" onClick={nextFromProfile}>Next</Button>
          </div>
        </div>
      )}

      {step === 'statements' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-neutral-900)]">How much do you agree?</h2>
            <p className="mt-2 text-base text-[var(--color-neutral-600)]">
              For each sentence, tap a number from <strong>1 (Strongly disagree)</strong> to <strong>5 (Strongly agree)</strong>.
            </p>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {SUS_STATEMENTS.length - missingStatements.length} of {SUS_STATEMENTS.length} answered
            </p>
          </div>

          {SUS_STATEMENTS.map((statement, index) => {
            const q = index + 1;
            const missing = showMissing && !answers[q];
            return (
              <fieldset
                key={q}
                ref={(el) => { statementRefs.current[index] = el; }}
                className={[
                  'rounded-[var(--radius-lg)] border-2 p-4 sm:p-5',
                  missing ? 'border-[var(--color-error)] bg-[var(--color-error-light)]' : 'border-[var(--color-neutral-200)] bg-white',
                ].join(' ')}
              >
                <legend className="sr-only">Statement {q}</legend>
                <p className="text-lg font-medium text-[var(--color-neutral-900)] mb-4">
                  <span className="text-[var(--color-primary)] font-bold mr-1.5">{q}.</span>{statement}
                </p>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={`Statement ${q}`}>
                  {SUS_SCALE.map((option) => {
                    const selected = answers[q] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${option.value} — ${option.label}`}
                        onClick={() => setAnswers((a) => ({ ...a, [q]: option.value }))}
                        className={[
                          'focusable min-h-[64px] rounded-[var(--radius-md)] border-2 flex flex-col items-center justify-center px-1 py-2 transition-colors',
                          selected
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                            : 'border-[var(--color-neutral-200)] bg-white text-[var(--color-neutral-800)] hover:border-[var(--color-primary)]',
                        ].join(' ')}
                      >
                        <span className="text-xl font-bold leading-none">{option.value}</span>
                        <span className={`mt-1 text-[11px] sm:text-xs leading-tight text-center ${selected ? 'text-white' : 'text-[var(--color-neutral-500)]'}`}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {missing && <p className="mt-2 text-sm font-medium text-[var(--color-error)]">Please answer this one.</p>}
              </fieldset>
            );
          })}

          {showMissing && missingStatements.length > 0 && (
            <p className="text-base font-medium text-[var(--color-error)]">
              Please answer all 10 sentences ({missingStatements.length} left).
            </p>
          )}
          <div className="flex flex-wrap gap-3 justify-between">
            <Button variant="secondary" size="lg" className="h-14 px-6 text-base" icon={ArrowLeft} onClick={() => goTo('profile')}>Back</Button>
            <Button size="lg" className="h-14 px-8 text-base" icon={ArrowRight} iconPosition="right" onClick={nextFromStatements}>Next</Button>
          </div>
        </div>
      )}

      {step === 'comments' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-neutral-900)]">Anything else to tell us?</h2>
            <p className="mt-2 text-base text-[var(--color-neutral-600)]">Optional. What did you like, or what was hard?</p>
          </div>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Type here (optional)"
            className="focusable w-full rounded-[var(--radius-md)] border-2 border-[var(--color-neutral-200)] p-4 text-base"
          />
          {error && <p className="text-base font-medium text-[var(--color-error)]" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3 justify-between">
            <Button variant="secondary" size="lg" className="h-14 px-6 text-base" icon={ArrowLeft}
              disabled={submitting} onClick={() => goTo('statements')}>
              Back
            </Button>
            <Button size="lg" className="h-14 px-8 text-base" icon={Send} loading={submitting} onClick={submit}>
              {submitting ? 'Sending…' : 'Submit answers'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SusSurvey;
