import { LotteryView } from '@/app/lottery/[id]/lottery_view';
import { getDraftLottery, getLottery } from '@/db/db';
import { DraftLottery, Lottery } from '@/db/schema';

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
  return (
    <div className="prose flex flex-col max-w-5xl m-auto mt-8">
      <h2>Lottery</h2>
      <LotteryView lottery={props.lottery} />
    </div>
  );
}

function DraftLotteryPage(props: { lottery: DraftLottery }) {
  return (
    <div className="prose flex flex-col max-w-5xl m-auto mt-8">
      <h2>Draft lottery</h2>
      <LotteryView lottery={props.lottery} />
    </div>
  );
}
