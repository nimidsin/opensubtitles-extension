import {getBackgroundPage} from "getBackgroundPage";

interface Payload {
  offsetTime: number;
}

export const setOffsetTimeInBackground = async (payload: Payload): Promise<void> => {
  (await getBackgroundPage()).plussub.setOffsetTime(payload);
};
