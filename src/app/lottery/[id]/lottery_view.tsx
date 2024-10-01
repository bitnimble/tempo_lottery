'use client';

import { Select } from '@/app/ui/select';
import { Button as JollyButton } from '@/components/ui/button';
import { JollyNumberField } from '@/components/ui/numberfield';
import { JollyTextField } from '@/components/ui/textfield';
import { saveLottery, tryPromoteLottery } from '@/db/db_actions';
import { Lottery, LotterySchema, LotteryType } from '@/db/schema';
import { getLocalTimeZone, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { Loader2 } from 'lucide-react';
import { action, observable, runInAction, toJS } from 'mobx';
import * as mobxReact from 'mobx-react';
import dynamic from 'next/dynamic';
import { Form, PressEvent } from 'react-aria-components';

const DateRangePicker = dynamic(
  () => import('@/components/ui/date-picker').then((c) => c.JollyDateRangePicker<ZonedDateTime>),
  { ssr: false }
);

type Store = {
  lottery: Lottery;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | undefined;
};

const lotteryTypeLabels: Record<LotteryType, string> = {
  [LotteryType.SIMPLE]: 'Simple',
  [LotteryType.LOWEST_UNIQUE_NUMBER]: 'Lowest unique number',
};

export const LotteryView = (props: { isDraft: boolean; lottery: Lottery }) => {
  const store = observable<Store>({
    lottery: props.lottery,
    isSaving: false,
    isPublishing: false,
    error: undefined,
  });

  const onSave = async (e: PressEvent) => {
    runInAction(() => (store.isSaving = true));
    await saveLottery(toJS(store.lottery));
    runInAction(() => (store.isSaving = false));
  };

  const onPublish = async (e: PressEvent) => {
    runInAction(() => (store.isPublishing = true));
    try {
      await saveLottery(toJS(store.lottery), true);
      await tryPromoteLottery(store.lottery.id);
    } catch (e: any) {
      runInAction(() => {
        store.isPublishing = false;
        store.error = e.toString();
      });
    }
    // Redirect to new promoted lottery page
    window.location.reload();
  };

  return (
    <_LotteryView isDraft={props.isDraft} store={store} onSave={onSave} onPublish={onPublish} />
  );
};

const _LotteryView = mobxReact.observer(
  (props: {
    isDraft: boolean;
    store: Store;
    onSave: (e: PressEvent) => Promise<void>;
    onPublish: (e: PressEvent) => Promise<void>;
  }) => {
    const l = props.store.lottery;
    const isSubmitting = props.store.isSaving || props.store.isPublishing;

    return (
      <Form className="flex flex-col gap-4">
        <div className="flex gap-4 w-full">
          <JollyTextField className="flex-1 bg-grey" label="ID" value={l.id} isReadOnly />
          <JollyTextField
            className="flex-1"
            label="Creator"
            value={l.creator}
            onChange={action((v) => (l.creator = v))}
            isReadOnly
          />
        </div>
        <div className="flex gap-4 w-full">
          <JollyTextField
            className="flex-1"
            label="Lottery name"
            value={l.title}
            onChange={action((v) => (l.title = v))}
          />
          <Select
            className="flex-1"
            label="Lottery type"
            labels={lotteryTypeLabels}
            values={LotterySchema.shape['lotteryType'].removeDefault().options}
            value={l.lotteryType}
            onChange={action((v: LotteryType) => (l.lotteryType = v))}
          />
        </div>

        <JollyTextField
          label="Prize"
          value={l.prize || ''}
          onChange={action((v) => (l.prize = v))}
        />
        <JollyTextField
          label="Description"
          value={l.description || ''}
          onChange={action((v) => (l.description = v))}
          textArea
        />
        <div className="mt-8"></div>
        <div className="flex gap-4 w-full">
          <JollyTextField
            className="flex-1"
            label="Role IDs needed to participate"
            value={l.roles?.join('\n') || ''}
            onChange={action((v) => (l.roles = v.split('\n').map((l) => l.trim())))}
            textArea
          />
          <JollyNumberField
            className="flex-1"
            label="Max winners"
            value={l.winnerCount}
            onChange={action((v) => (l.winnerCount = v))}
          />
        </div>

        <JollyNumberField
          label="Max bids per user"
          value={l.maxBidsPerUser}
          onChange={action((v) => (l.maxBidsPerUser = v))}
        />
        <DateRangePicker
          label="Start and end date"
          granularity="minute"
          value={{
            start: parseAbsolute(l.startAt, getLocalTimeZone()),
            end: parseAbsolute(l.startAt, getLocalTimeZone()).add({
              milliseconds: l.duration,
            }),
          }}
          onChange={action((v: { start: ZonedDateTime; end: ZonedDateTime }) => {
            l.startAt = v.start.toAbsoluteString();
            l.duration = +v.end.toDate() - +v.start.toDate();
          })}
        />
        <JollyNumberField
          label="Repeat interval"
          value={l.repeatInterval}
          onChange={action((v) => (l.repeatInterval = v))}
        />
        <div className="flex gap-4 w-full">
          <JollyNumberField
            className="flex-1"
            label="Minimum bid"
            value={l.minimumBid}
            onChange={action((v) => (l.minimumBid = v))}
          />
          <JollyNumberField
            className="flex-1"
            label="Maximum bid"
            value={l.maximumBid}
            onChange={action((v) => (l.maximumBid = v))}
          />
        </div>

        {props.store.error && (
          <div className="w-full bg-red-600 rounded-md text-white my-4 p-4">
            {props.store.error}
          </div>
        )}

        <div className="flex gap-2">
          <JollyButton isDisabled={isSubmitting} onPress={props.onSave}>
            Save
            {props.store.isSaving && <Loader2 className="ml-2 size-4 animate-spin" />}
          </JollyButton>

          {props.isDraft && (
            <JollyButton isDisabled={isSubmitting} variant="secondary" onPress={props.onPublish}>
              Publish
              {props.store.isPublishing && <Loader2 className="ml-2 size-4 animate-spin" />}
            </JollyButton>
          )}
        </div>
      </Form>
    );
  }
);
