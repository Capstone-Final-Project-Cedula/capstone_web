import { OFFLINE_BIRTH_RESULT, checkAnswer } from './answerCheck';

const down = () => Promise.reject(new Error('Network Error'));
const accepts = () => ({ ok: true, value: 'Sounds Good', methods: ['local'] });

describe('checkAnswer (plan 001.8)', () => {
  test('the backend answer is used when it is reachable', async () => {
    const data = { ok: true, value: 'Lantapan, Bukidnon' };
    await expect(checkAnswer({ request: () => Promise.resolve({ data }), local: accepts, key: 'place_of_birth' }))
      .resolves.toBe(data);
  });

  test.each(['place_of_birth', 'place_of_birth_province', 'place_of_birth_town'])(
    'backend down: a spoken %s is refused, never accepted by the local check',
    async (key) => {
      const local = jest.fn(accepts);
      const result = await checkAnswer({ request: down, local, key, spoken: true });
      expect(result).toBe(OFFLINE_BIRTH_RESULT);
      expect(result.ok).toBe(false);
      expect(local).not.toHaveBeenCalled();
    },
  );

  test('backend down: a typed place of birth and other spoken answers use the local check', async () => {
    await expect(checkAnswer({ request: down, local: accepts, key: 'place_of_birth', spoken: false }))
      .resolves.toMatchObject({ ok: true });
    await expect(checkAnswer({ request: down, local: accepts, key: 'surname', spoken: true }))
      .resolves.toMatchObject({ ok: true });
  });

  test('a 401 is passed on', async () => {
    const expired = Object.assign(new Error('401'), { response: { status: 401 } });
    await expect(checkAnswer({ request: () => Promise.reject(expired), local: accepts, key: 'surname' }))
      .rejects.toBe(expired);
  });
});
