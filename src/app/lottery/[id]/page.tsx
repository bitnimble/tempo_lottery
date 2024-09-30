import { LotteryView } from '@/app/lottery/[id]/lottery_view';
import { getDraftLottery, getLottery } from '@/db/db';
import { DraftLottery, Lottery } from '@/db/schema';
import { getNextResultsDate } from '@/lottery/lottery';

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const lottery = getLottery(id);
  const draftLottery = getDraftLottery(id);
  if (lottery) {
    return <LotteryPage lottery={lottery} />;
  } else if (draftLottery) {
    return <DraftLotteryPage lottery={draftLottery} />;
  }
  return <div>Lottery not found</div>;
}

function LotteryPage(props: { lottery: Lottery }) {
  const nextDraw = getNextResultsDate(props.lottery);
  return (
    <div className="prose flex flex-col max-w-5xl m-auto my-8">
      <h2>Lottery</h2>
      <h4>Next draw date: {nextDraw ? nextDraw.toString() : 'never'}</h4>
      <h4>Current bids: {props.lottery.bids.length} </h4>
      <LotteryView isDraft={false} lottery={props.lottery} />
    </div>
  );
}

function DraftLotteryPage(props: { lottery: DraftLottery }) {
  return (
    <div className="prose flex flex-col max-w-5xl m-auto my-8">
      <h2>Draft lottery</h2>
      <LotteryView isDraft={true} lottery={props.lottery} />
    </div>
  );
}
