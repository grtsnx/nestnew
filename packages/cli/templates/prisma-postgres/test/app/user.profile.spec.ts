import { pickProfileUpdate } from 'src/modules/user/user.service';

describe('pickProfileUpdate', () => {
  it('returns only the fields the user sent', () => {
    expect(
      pickProfileUpdate({
        name: ' Jane Doe ',
        image: 'https://cdn.mail.test/avatars/jane.png',
      }),
    ).toEqual({
      name: 'Jane Doe',
      image: 'https://cdn.mail.test/avatars/jane.png',
    });
  });

  it('includes username and telephone when provided', () => {
    expect(
      pickProfileUpdate({
        username: 'jane_doe',
        telephone: '+15551234567',
      }),
    ).toEqual({
      username: 'jane_doe',
      telephone: '+15551234567',
    });
  });

  it('returns null when nothing would change', () => {
    expect(pickProfileUpdate({})).toBeNull();
    expect(pickProfileUpdate({ name: '   ' })).toBeNull();
  });
});
