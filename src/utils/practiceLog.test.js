import { createPracticeRecorder, createPracticeSession } from './practiceLog';

const clock = (start = 1000) => {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
};

describe('practice recorder (plan 001.7)', () => {
  test('a question answered on the second try builds one note with tries, seconds and engine', () => {
    const c = clock();
    const rec = createPracticeRecorder({ now: c.now });
    rec.asked('surname');
    c.advance(2000);
    rec.heard('surname', { text: 'rayes', engine: 'whisper', seconds: 0.8 });
    rec.parsed('surname', { ok: true, value: 'Rayes' });
    c.advance(5000);
    rec.asked('surname');                       // asked again: the clock keeps running
    rec.heard('surname', { text: 'reyes', engine: 'whisper', seconds: 0.7 });
    rec.parsed('surname', { ok: true, value: 'Reyes' });
    c.advance(1500);
    const note = rec.accept('surname', 'Reyes');

    expect(note).toEqual({
      field: 'surname',
      attempts: 2,
      attempt_details: [
        { heard: 'rayes', engine: 'whisper', seconds: 0.8, parsed: 'Rayes', ok: true, reason: null },
        { heard: 'reyes', engine: 'whisper', seconds: 0.7, parsed: 'Reyes', ok: true, reason: null },
      ],
      first_value: 'Rayes',                   // the FIRST voice-parsed value, not the accepted one
      accepted_value: 'Reyes',
      accepted_engine: 'whisper',
      seconds: 8.5,
    });
  });

  test('the first value is kept in the saved form (birthday as the ISO date)', () => {
    const rec = createPracticeRecorder({
      savedForm: (field, value) => (field === 'date' ? '1995-06-20' : value),
    });
    rec.asked('date');
    rec.heard('date', { text: 'june twenty nineteen ninety five', engine: 'whisper', seconds: 0.9 });
    rec.parsed('date', { ok: true, value: 'June 20, 1995' });
    const note = rec.accept('date', 'June 20, 1995');
    expect(note.first_value).toBe('1995-06-20');
    expect(note.accepted_value).toBe('June 20, 1995');
  });

  test('a spelled or typed fix is the accepted engine and never the first voice value', () => {
    const rec = createPracticeRecorder();
    rec.asked('surname');
    rec.heard('surname', { text: 'bakus', engine: 'whisper', seconds: 0.8 });
    rec.parsed('surname', { ok: true, value: 'Bakus' });
    rec.heard('surname', { text: 'B A C U S', engine: 'spelled' });
    rec.parsed('surname', { ok: true, value: 'Bacus' });
    const note = rec.accept('surname', 'Bacus');
    expect(note.first_value).toBe('Bakus');
    expect(note.accepted_engine).toBe('spelled');
    expect(note.attempts).toBe(2);

    rec.asked('given_name');
    rec.heard('given_name', { text: 'Maria', engine: 'typed' });
    rec.parsed('given_name', { ok: true, value: 'Maria' });
    expect(rec.accept('given_name', 'Maria').first_value).toBeNull();   // never parsed from voice
  });

  test('an unusable attempt keeps its reason and a given-up question is skipped', () => {
    const rec = createPracticeRecorder();
    rec.asked('height');
    rec.heard('height', { text: '', engine: 'whisper', reason: 'no-speech' });
    rec.heard('height', { text: 'tall', engine: 'whisper', seconds: 0.6 });
    rec.parsed('height', { ok: false, reason: 'not_a_number', value: '' });
    const note = rec.skip('height');
    expect(note.accepted_engine).toBe('skipped');
    expect(note.accepted_value).toBeNull();
    expect(note.first_value).toBeNull();
    expect(note.attempts).toBe(2);
    expect(note.attempt_details[0]).toMatchObject({ heard: '', reason: 'no-speech' });
    expect(note.attempt_details[1]).toMatchObject({ ok: false, reason: 'not_a_number' });
  });

  test('the browser engine is recorded, and a later question starts from nothing', () => {
    const rec = createPracticeRecorder();
    rec.asked('sex');
    rec.heard('sex', { text: 'female', engine: 'browser' });
    rec.parsed('sex', { ok: true, value: 'Female' });
    expect(rec.accept('sex', 'Female')).toMatchObject({ accepted_engine: 'browser', first_value: 'Female' });
    rec.reset();                                  // a new applicant starts from nothing
    rec.asked('sex');
    expect(rec.skip('sex').attempts).toBe(0);
  });

  test('a question visited again keeps its first voice value and tries, so the correction counts', () => {
    const c = clock();
    const rec = createPracticeRecorder({ now: c.now });
    rec.asked('surname');
    rec.heard('surname', { text: 'bakus', engine: 'whisper', seconds: 0.8 });
    rec.parsed('surname', { ok: true, value: 'Bakus' });
    const first = rec.accept('surname', 'Bakus');
    expect(first.attempt_details).toHaveLength(1);

    c.advance(60000);
    rec.asked('surname');                         // "go back to my surname"
    c.advance(2000);
    rec.heard('surname', { text: 'bacus', engine: 'whisper', seconds: 0.7 });
    rec.parsed('surname', { ok: true, value: 'Bacus' });
    const again = rec.accept('surname', 'Bacus');
    expect(again.first_value).toBe('Bakus');      // not replaced by the correction
    expect(again.attempts).toBe(2);
    expect(again.seconds).toBe(2);                // the clock restarted at the revisit
    expect(first.attempt_details).toHaveLength(1); // the earlier note was not changed afterwards
  });

  test('address parts are noted one by one, then one joined summary row with the total seconds', () => {
    const c = clock();
    const rec = createPracticeRecorder({ now: c.now, savedForm: (field, value) => `saved:${value}` });
    ['address_town', 'address_barangay', 'address_purok'].forEach((key, i) => {
      rec.asked(key);
      rec.heard(key, { text: `part ${i}`, engine: 'whisper', seconds: 0.7 });
      rec.parsed(key, { ok: true, value: `value ${i}` });
      c.advance(3000);
      expect(rec.accept(key, `value ${i}`)).toMatchObject({ field: key, accepted_value: `value ${i}`, seconds: 3 });
    });
    const joined = rec.joined('Purok 2, Barangay Imbatug, Baungon, Bukidnon');
    expect(joined).toMatchObject({
      field: 'address',
      attempts: 0,
      first_value: 'saved:Purok 2, Barangay Imbatug, Baungon, Bukidnon',
      accepted_value: 'Purok 2, Barangay Imbatug, Baungon, Bukidnon',
      seconds: 9,
    });
  });

  test('the place of birth steps make one row: tries summed, timed from the first ask, first whole place (plan 001.8)', () => {
    const c = clock();
    const rec = createPracticeRecorder({ now: c.now });
    rec.asked('place_of_birth');                                   // the shortcut question
    rec.heard('place_of_birth', { text: 'No.', engine: 'whisper' });
    rec.parsed('place_of_birth', { ok: false, value: '' }, { partial: true });
    c.advance(4000);
    rec.asked('place_of_birth');                                   // the province question: clock keeps running
    rec.heard('place_of_birth', { text: 'Bokidnon', engine: 'whisper' });
    rec.parsed('place_of_birth', { ok: true, value: 'Bukidnon' }, { partial: true });
    c.advance(4000);
    rec.asked('place_of_birth');                                   // the town question
    rec.heard('place_of_birth', { text: 'Lantap', engine: 'whisper' });
    rec.parsed('place_of_birth', { ok: true, value: 'Lantapan, Bukidnon' });
    c.advance(2000);
    const note = rec.accept('place_of_birth', 'Lantapan, Bukidnon');
    expect(note).toMatchObject({
      field: 'place_of_birth', attempts: 3, seconds: 10, first_value: 'Lantapan, Bukidnon', accepted_value: 'Lantapan, Bukidnon',
    });
  });

  test('long heard text is cut to what the backend accepts', () => {
    const rec = createPracticeRecorder();
    rec.asked('occupation');
    rec.heard('occupation', { text: 'x'.repeat(900), engine: 'whisper' });
    expect(rec.accept('occupation', 'y'.repeat(900)).attempt_details[0].heard).toHaveLength(500);
  });
});

describe('practice session (plan 001.7)', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const makeApi = (start) => ({
    start: jest.fn().mockResolvedValue({ data: start }),
    addAnswer: jest.fn().mockResolvedValue({}),
    finish: jest.fn().mockResolvedValue({}),
  });

  test('a spoken "none" is kept as the first value, so "none" then "Santos" counts as a correction', () => {
    const rec = createPracticeRecorder({ savedForm: (field, value) => (String(value).trim() || null) });
    rec.asked('middle_name');
    rec.heard('middle_name', { text: 'none', engine: 'whisper', seconds: 0.6 });
    rec.parsed('middle_name', { ok: true, value: '' });
    expect(rec.accept('middle_name', '').first_value).toBeNull();
    rec.asked('middle_name');                     // revisit
    rec.heard('middle_name', { text: 'santos', engine: 'whisper', seconds: 0.6 });
    rec.parsed('middle_name', { ok: true, value: 'Santos' });
    expect(rec.accept('middle_name', 'Santos').first_value).toBeNull();   // not replaced by "Santos"
  });

  test('closing the tab sends a keepalive finish at once, without waiting for the queue', async () => {
    const api = { ...makeApi({ enabled: true, session_id: 7 }), finishKeepalive: jest.fn() };
    const session = createPracticeSession(api);
    session.start();
    await flush();
    session.finish({ keepalive: true });
    expect(api.finishKeepalive).toHaveBeenCalledWith(7);
    await flush();
    expect(api.finish).not.toHaveBeenCalled();
  });

  test('log off: nothing is ever sent after start', async () => {
    const api = makeApi({ enabled: false, session_id: null });
    const session = createPracticeSession(api);
    session.start('manual');
    session.note({ field: 'surname' });
    session.finish();
    await flush();
    expect(api.start).toHaveBeenCalledWith('manual');
    expect(api.addAnswer).not.toHaveBeenCalled();
    expect(api.finish).not.toHaveBeenCalled();
    expect(session.id).toBeNull();
  });

  test('notes sent before the session id arrives go out in order, then finish', async () => {
    const api = makeApi({ enabled: true, session_id: 7 });
    const session = createPracticeSession(api);
    session.start();
    session.note({ field: 'surname' });
    session.note({ field: 'given_name' });
    session.finish();
    await flush();
    expect(api.addAnswer.mock.calls.map((call) => [call[0], call[1].field])).toEqual([[7, 'surname'], [7, 'given_name']]);
    expect(api.finish).toHaveBeenCalledWith(7);
    expect(session.active).toBe(false);
  });

  test('after the CTC is issued a late note still goes out, but finish does not', async () => {
    const api = makeApi({ enabled: true, session_id: 7 });
    const session = createPracticeSession(api);
    session.start();
    await flush();
    expect(session.id).toBe(7);
    session.note({ field: 'surname' });
    session.issued();
    session.finish();
    await flush();
    expect(api.addAnswer).toHaveBeenCalledTimes(1);
    expect(api.finish).not.toHaveBeenCalled();
  });

  test('a failing backend never throws into the interview', async () => {
    const api = makeApi({ enabled: true, session_id: 7 });
    api.addAnswer.mockRejectedValue(new Error('network'));
    const session = createPracticeSession(api);
    session.start();
    session.note({ field: 'surname' });
    session.note({ field: 'given_name' });
    await flush();
    expect(api.addAnswer).toHaveBeenCalledTimes(2);
  });
});
