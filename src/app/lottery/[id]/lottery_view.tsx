'use client';

import { delay } from '@/app/base/delay';
import { Select } from '@/app/ui/select';
import { Button as JollyButton } from '@/components/ui/button';
import { JollyDateRangePicker } from '@/components/ui/date-picker';
import { JollyNumberField } from '@/components/ui/numberfield';
import { JollyTextField } from '@/components/ui/textfield';
import { saveLottery, tryPromoteLottery } from '@/db/db_actions';
import { DraftLottery, LotterySchema, LotteryType } from '@/db/schema';
import { getLocalTimeZone, now, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { Loader2 } from 'lucide-react';
import { action, observable, runInAction, toJS } from 'mobx';
import * as mobxReact from 'mobx-react';
import { Form, PressEvent } from 'react-aria-components';

type Store = {
  lottery: DraftLottery;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | undefined;
};

const lotteryTypeLabels: Record<LotteryType, string> = {
  [LotteryType.SIMPLE]: 'Simple',
  [LotteryType.LOWEST_UNIQUE_NUMBER]: 'Lowest unique number',
};

export const LotteryView = (props: { isDraft: boolean; lottery: DraftLottery }) => {
  const store = observable<Store>({
    lottery: props.lottery,
    isSaving: false,
    isPublishing: false,
    error: undefined,
  });

  const onSave = async (e: PressEvent) => {
    runInAction(() => (store.isSaving = true));
    await saveLottery(toJS(store.lottery));
    await delay(100);
    runInAction(() => (store.isSaving = false));
  };

  const onPublish = async (e: PressEvent) => {
    runInAction(() => (store.isPublishing = true));
    try {
      await saveLottery(toJS(store.lottery));
      await tryPromoteLottery(store.lottery.id);
    } catch (e: any) {
      runInAction(() => {
        store.isPublishing = false;
        store.error = e.toString();
      });
    }
    // Redirect to new promoted lottery page
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
        <JollyTextField label="ID" value={l.id} isReadOnly />
        <JollyTextField
          label="Lottery name"
          value={l.title || ''}
          onChange={action((v) => (l.title = v))}
        />
        <Select
          label="Lottery type"
          labels={lotteryTypeLabels}
          values={LotterySchema.shape['lotteryType'].options}
          value={l.lotteryType}
          onChange={action((v: LotteryType) => (l.lotteryType = v))}
        />

        <JollyTextField
          label="Description"
          value={l.description || ''}
          onChange={action((v) => (l.description = v))}
          textArea
        />
        <JollyTextField
          label="Banner image (URL)"
          value={l.banner || ''}
          onChange={action((v) => (l.banner = v))}
        />
        <JollyTextField
          label="Prize"
          value={l.prize || ''}
          onChange={action((v) => (l.prize = v))}
        />
        <JollyTextField
          label="Creator"
          value={l.host || ''}
          onChange={action((v) => (l.host = v))}
        />
        <JollyTextField
          label="Roles"
          value={l.roles?.join('\n') || ''}
          onChange={action((v) => (l.roles = v.split('\n').map((l) => l.trim())))}
          textArea
        />
        <JollyDateRangePicker
          label="Start date"
          defaultValue={{
            start: now(getLocalTimeZone()),
            end: now(getLocalTimeZone()).add({ weeks: 1 }),
          }}
          granularity="minute"
          value={
            l.startAt && l.duration
              ? {
                  start: parseAbsolute(l.startAt, getLocalTimeZone()),
                  end: parseAbsolute(l.startAt, getLocalTimeZone()).add({
                    milliseconds: l.duration,
                  }),
                }
              : undefined
          }
          onChange={action((v: { start: ZonedDateTime; end: ZonedDateTime }) => {
            l.startAt = v.start.toAbsoluteString();
            l.duration = +v.end.toDate() - +v.start.toDate();
          })}
        />
        <JollyNumberField
          label="Repeat interval"
          value={l.repeatInterval || 0}
          onChange={action((v) => (l.repeatInterval = v))}
        />
        <JollyNumberField
          label="Max winners"
          value={l.winnerCount || 1}
          onChange={action((v) => (l.winnerCount = v))}
        />
        <JollyNumberField
          label="Minimum bid"
          value={l.minimumBid || 1}
          onChange={action((v) => (l.minimumBid = v))}
        />
        <JollyNumberField
          label="Maximum bid"
          value={l.maximumBid || 1000}
          onChange={action((v) => (l.maximumBid = v))}
        />

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
