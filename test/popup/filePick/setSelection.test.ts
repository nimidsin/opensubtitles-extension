import { setSelection } from '@/filepick/setSelection';
import { AppState, setAppStatePartial, snapshot } from '@/appState';
import { getInitialState } from '@/appState/getInitialState';

jest.mock('@/appState', () => ({
  __esModule: true,
  setAppStatePartial: jest.fn(),
  snapshot: jest.fn()
}));

describe('set selection', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('without previous result', async () => {
    const appState: AppState = getInitialState();
    (snapshot as jest.Mock).mockResolvedValue(appState);

    await setSelection({ filename: 'given filename', rawSrt: 'given srt' });

    expect(setAppStatePartial).toHaveBeenCalledWith({
      src: 'FILE',
      state: 'SELECTED',
      filePick: {
        filename: 'given filename'
      },
      srt: {
        raw: 'given srt',
        parsed: [],
        withOffsetParsed: []
      }
    });
  });
});
