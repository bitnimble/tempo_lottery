import { LotteryView } from '@/app/lottery/[id]/lottery_view';
import { getDraftLottery, getLottery } from '@/db/db';
import { Lottery } from '@/db/schema';
import { getDrawDate } from '@/lottery/lottery';
import React from 'react';

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const lottery = getLottery(id);
  const draftLottery = getDraftLottery(id);
  let LotteryView: React.ReactNode;
  if (lottery) {
    LotteryView = <LotteryPage lottery={lottery} />;
  } else if (draftLottery) {
    LotteryView = <DraftLotteryPage lottery={draftLottery} />;
  } else {
    return <div>Lottery not found</div>;
  }

  return (
    <div className="prose flex flex-col max-w-5xl m-auto my-8">
      <a href="/lottery">‹ Back to lottery list</a>
      {LotteryView}
    </div>
  );
}

function LotteryPage(props: { lottery: Lottery }) {
  const nextDraw = getDrawDate(props.lottery);
  return (
    <div>
      <h2 className="my-4">Lottery</h2>
      <h4>Next draw date: {nextDraw ? nextDraw.toDate().toString() : 'never'}</h4>
      <h4>Current bids: {props.lottery.bids.length} </h4>
      <LotteryView isDraft={false} lottery={props.lottery} />
    </div>
  );
}

function DraftLotteryPage(props: { lottery: Lottery }) {
  return (
    <div>
      <h2 className="my-4">Draft lottery</h2>
      <LotteryView isDraft={true} lottery={props.lottery} />
    </div>
  );
}
