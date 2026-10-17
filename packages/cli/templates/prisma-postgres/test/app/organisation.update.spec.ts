import { pickOrganisationUpdate } from 'src/modules/organisation/organisation.service';

describe('pickOrganisationUpdate', () => {
  it('returns only the fields the user sent', () => {
    expect(
      pickOrganisationUpdate({
        name: ' Acme Inc ',
        slug: 'acme-inc',
        logo: 'https://cdn.mail.test/acme/logo.png',
      }),
    ).toEqual({
      name: 'Acme Inc',
      slug: 'acme-inc',
      logo: 'https://cdn.mail.test/acme/logo.png',
    });
  });

  it('keeps metadata when provided', () => {
    expect(pickOrganisationUpdate({ metadata: { seats: 25 } })).toEqual({
      metadata: { seats: 25 },
    });
  });

  it('returns null when nothing would change', () => {
    expect(pickOrganisationUpdate({})).toBeNull();
    expect(pickOrganisationUpdate({ name: '   ' })).toBeNull();
  });
});
