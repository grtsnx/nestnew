import { pickTeamUpdate } from 'src/modules/team/team.service';

describe('pickTeamUpdate', () => {
  it('returns a trimmed team name', () => {
    expect(pickTeamUpdate({ name: ' Design ' })).toEqual({ name: 'Design' });
  });

  it('returns null when nothing would change', () => {
    expect(pickTeamUpdate({})).toBeNull();
    expect(pickTeamUpdate({ name: '   ' })).toBeNull();
  });
});
