import { combineSessions, createEvalContext, createEvalSession, toFieldNote } from './evalLog';

const ids = () => {
  let n = 0;
  return () => `try${(n += 1)}`;
};

describe('the evaluation context (plan 003): what each call carries', () => {
  test('nothing is sent without a running session', () => {
    const ctx = createEvalContext();
    expect(ctx.forTranscribe('surname')).toBeNull();
    expect(ctx.forExtraction('surname')).toBeNull();
  });

  test('a question key is its own field and a spoken try', () => {
    const ctx = createEvalContext({ newId: ids() });
    ctx.setSession(7);
    expect(ctx.forTranscribe('surname')).toEqual({ session: 7, field: 'surname', step: 'spoken', tryId: 'try1' });
  });

  test('the answer check joins the Whisper try just before it (same try id and step)', () => {
    const ctx = createEvalContext({ newId: ids() });
    ctx.setSession(7);
    ctx.forTranscribe('given_name');
    expect(ctx.forExtraction('given_name')).toEqual({ session: 7, step: 'spoken', tryId: 'try1' });
    // used once: the next check has no Whisper call behind it (browser engine or typed)
    expect(ctx.forExtraction('given_name')).toEqual({ session: 7, step: 'spoken', tryId: null });
  });

  test('a check for another question does not take the pending try', () => {
    const ctx = createEvalContext({ newId: ids() });
    ctx.setSession(7);
    ctx.forTranscribe('surname');
    expect(ctx.forExtraction('sex').tryId).toBeNull();
  });

  test('a stale try (older than a minute) is not joined', () => {
    let time = 0;
    const ctx = createEvalContext({ newId: ids(), now: () => time });
    ctx.setSession(7);
    ctx.forTranscribe('surname');
    time = 61000;
    expect(ctx.forExtraction('surname').tryId).toBeNull();
  });

  test('spelling is a spelled try of the question being asked', () => {
    const ctx = createEvalContext({ newId: ids() });
    ctx.setSession(7);
    ctx.ask('surname');
    expect(ctx.forTranscribe('spelling')).toEqual({ session: 7, field: 'surname', step: 'spelled', tryId: 'try1' });
    expect(ctx.forExtraction('surname')).toEqual({ session: 7, step: 'spelled', tryId: 'try1' });
  });

  test('yes / no answers are confirm steps and are never joined to the next answer check', () => {
    const ctx = createEvalContext({ newId: ids() });
    ctx.setSession(7);
    ctx.ask('place_of_birth_town');
    expect(ctx.forTranscribe('confirm')).toMatchObject({ field: 'place_of_birth_town', step: 'confirm' });
    expect(ctx.forExtraction('place_of_birth_town').tryId).toBeNull();
    expect(ctx.forTranscribe('review')).toMatchObject({ field: 'review', step: 'review' });
  });

  test('after the end step starts, spoken answers are end_said tries', () => {
    const ctx = createEvalContext({ newId: ids() });
    ctx.setSession(7);
    ctx.endStep();
    expect(ctx.forTranscribe('height').step).toBe('end_said');
    expect(ctx.forExtraction('height').step).toBe('end_said');
    ctx.reset();
    expect(ctx.forTranscribe('height').step).toBe('spoken');
  });

  test('a confirm with no question asked yet is not logged', () => {
    const ctx = createEvalContext();
    ctx.setSession(7);
    expect(ctx.forTranscribe('confirm')).toBeNull();
  });
});

describe('the evaluation session', () => {
  const fakeApi = (sessionId = 11) => ({
    start: jest.fn().mockResolvedValue({ data: { session_id: sessionId } }),
    finish: jest.fn().mockResolvedValue({}),
    finishKeepalive: jest.fn(),
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  test('start sets the id on the context; the batch carries the notes', async () => {
    const api = fakeApi();
    const ctx = createEvalContext();
    const session = createEvalSession(api, ctx, { device: () => 'Test PC' });
    session.start('manual');
    await settle();
    expect(api.start).toHaveBeenCalledWith('manual', 'Test PC');
    expect(session.id).toBe(11);
    expect(ctx.sessionId).toBe(11);
    session.note({ field: 'surname', accepted_engine: 'whisper', accepted_value: 'Cruz', seconds: 3.2, attempt_details: [] });
    session.note({ field: 'surname', accepted_engine: 'typed', accepted_value: 'Cruz', seconds: 9, attempt_details: [{ reason: 'left-blank' }] });
    expect(session.batch()).toEqual({
      notes: [{ field: 'surname', accepted_engine: 'typed', accepted_value: 'Cruz', left_blank: true, skipped: false, seconds: 9 }],
      errors: 0,
    });
  });

  test('logging off on the backend (no session id): nothing more is ever sent', async () => {
    const api = fakeApi(null);
    const ctx = createEvalContext();
    const session = createEvalSession(api, ctx);
    session.start('manual');
    await settle();
    expect(session.active).toBe(false);
    expect(ctx.sessionId).toBeNull();
    session.note({ field: 'surname', attempt_details: [] });
    session.finish();
    await settle();
    expect(api.finish).not.toHaveBeenCalled();
  });

  test('leaving before the CTC is issued finishes the session with the batch, once', async () => {
    const api = fakeApi();
    const session = createEvalSession(api, createEvalContext());
    session.start('manual');
    await settle();
    session.note({ field: 'sex', accepted_engine: 'skipped', accepted_value: null, attempt_details: [{ reason: 'whisper-failed' }] });
    session.finish();
    session.finish();
    await settle();
    expect(api.finish).toHaveBeenCalledTimes(1);
    expect(api.finish).toHaveBeenCalledWith(11, expect.objectContaining({ errors: 1 }));
  });

  test('closing the tab uses the keepalive request', async () => {
    const api = fakeApi();
    const session = createEvalSession(api, createEvalContext());
    session.start('manual');
    await settle();
    session.finish({ keepalive: true });
    expect(api.finishKeepalive).toHaveBeenCalledWith(11, { notes: [], errors: 0 });
  });

  test('an issued session is not finished as abandoned afterwards', async () => {
    const api = fakeApi();
    const ctx = createEvalContext();
    const session = createEvalSession(api, ctx);
    session.start('manual');
    await settle();
    session.issued();
    session.finish();
    await settle();
    expect(api.finish).not.toHaveBeenCalled();
    expect(ctx.sessionId).toBeNull();
  });

  test('toFieldNote keeps skips and the left-blank marker', () => {
    expect(toFieldNote({ field: 'icr_no', accepted_engine: 'skipped', accepted_value: null, seconds: null, attempt_details: [] }))
      .toMatchObject({ skipped: true, accepted_value: null, seconds: null });
  });
});

describe('combineSessions', () => {
  test('one call feeds both logs; the practice id stays the practice id', () => {
    const practice = { id: 5, active: true, start: jest.fn(), note: jest.fn(), issued: jest.fn(), finish: jest.fn() };
    const evaluation = { id: 9, active: true, start: jest.fn(), note: jest.fn(), issued: jest.fn(), finish: jest.fn(), batch: () => ({ notes: [] }) };
    const both = combineSessions(practice, evaluation);
    both.start('manual');
    both.note({ field: 'surname' });
    both.issued();
    both.finish({ keepalive: true });
    expect(both.id).toBe(5);
    expect(both.evalId).toBe(9);
    expect(both.evalBatch()).toEqual({ notes: [] });
    [practice, evaluation].forEach((log) => {
      expect(log.start).toHaveBeenCalledWith('manual');
      expect(log.note).toHaveBeenCalledWith({ field: 'surname' });
      expect(log.issued).toHaveBeenCalled();
      expect(log.finish).toHaveBeenCalledWith({ keepalive: true });
    });
  });
});
