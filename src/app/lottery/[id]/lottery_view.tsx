'use client';

import { Select } from '@/app/ui/select';
import { Button as JollyButton } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogOverlay, DialogTrigger } from '@/components/ui/modal';
import { JollyNumberField } from '@/components/ui/numberfield';
import { JollyTextField } from '@/components/ui/textfield';
import {
  saveLottery,
  tryDeleteLottery,
  tryPublishLottery,
  tryUnpublishLottery,
  updateLotterySchedule,
} from '@/db/db_actions';
import { Lottery, LotterySchema, LotteryType, lotteryTypeLabels } from '@/db/schema';
import { getDiscordUser, upsertLotteryAnnouncement } from '@/discord/discord_client_actions';
import { getLocalTimeZone, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { Loader2 } from 'lucide-react';
import { action, observable, runInAction, toJS } from 'mobx';
import * as mobxReact from 'mobx-react';
import dynamic from 'next/dynamic';
import React from 'react';
import { Form, PressEvent } from 'react-aria-components';
import timespan from 'timespan-parser';

const enum LoadingState {
  IDLE,
  SAVING,
  PUBLISHING,
  UNPUBLISHING,
  DELETING,
}

// Because the value / content of the datetime picker is client dependent (as the displayed value is
// based on the local time zone), SSR leads to a content mismatch. We force this component to be
// dynamic instead, and just display a readonly text field (which has the same dimensions and
// appearance as a blank datetime picker) for the initial SSR prerendering.
const DateRangePicker = dynamic(
  () => import('@/components/ui/date-picker').then((c) => c.JollyDateRangePicker<ZonedDateTime>),
  {
    ssr: false,
    loading: () => (
      <JollyTextField className="flex-1 bg-grey" label="Start and end date" isReadOnly />
    ),
  }
);

type Store = {
  lottery: Lottery;
  creator?: { name: string; iconURL: string | undefined };
  state: LoadingState;
  error: unknown | undefined;
  repeatInterval: string;
  parsedRepeatInterval: number;
  validationErrors: {
    repeatInterval?: string;
  };
};

export const LotteryView = (props: { isDraft: boolean; lottery: Lottery }) => {
  const store = observable<Store>({
    lottery: props.lottery,
    creator: undefined,
    state: LoadingState.IDLE,
    error: undefined,
    repeatInterval:
      props.lottery.repeatInterval > 0
        ? timespan.getString(props.lottery.repeatInterval, { unit: 'ms', valueSep: ', ' })
        : 'never',
    parsedRepeatInterval: props.lottery.repeatInterval,
    validationErrors: {
      repeatInterval: undefined,
    },
  });

  const makeLoadingCall = (state: LoadingState, call: () => Promise<void>) => {
    return async () => {
      runInAction(() => (store.state = state));
      try {
        await call();
        if (state === LoadingState.DELETING) {
          window.location.href = '/lottery';
        } else {
          window.location.reload();
        }
      } catch (e) {
        store.error = e;
      } finally {
        runInAction(() => (store.state = LoadingState.IDLE));
      }
    };
  };

  const validateFields = () => {
    if (!!store.validationErrors.repeatInterval) {
      throw new Error('Cannot save with errors');
    }
  };

  const onSave = makeLoadingCall(LoadingState.SAVING, async () => {
    validateFields();
    const announced = store.lottery.announcementId != null;
    await saveLottery(toJS(store.lottery));
    await updateLotterySchedule(store.lottery.id);
    if (announced && !props.isDraft) {
      await upsertLotteryAnnouncement(store.lottery.id);
    }
  });

  const onPublish = makeLoadingCall(LoadingState.PUBLISHING, async () => {
    validateFields();
    await saveLottery(toJS(store.lottery));
    await tryPublishLottery(store.lottery.id);
  });

  const onUnpublish = makeLoadingCall(LoadingState.UNPUBLISHING, async () => {
    validateFields();
    await saveLottery(toJS(store.lottery));
    await tryUnpublishLottery(store.lottery.id);
  });

  const onDelete = makeLoadingCall(LoadingState.DELETING, async () => {
    await tryDeleteLottery(store.lottery.id);
  });

  React.useEffect(() => {
    getDiscordUser(props.lottery.creator).then((u) => {
      if (u) {
        runInAction(() => (store.creator = u));
      }
    });
  });

  return (
    <_LotteryView
      isDraft={props.isDraft}
      store={store}
      onSave={onSave}
      onPublish={onPublish}
      onUnpublish={onUnpublish}
      onDelete={onDelete}
    />
  );
};

const _LotteryView = mobxReact.observer(
  (props: {
    isDraft: boolean;
    store: Store;
    onSave: (e: PressEvent) => Promise<void>;
    onPublish: (e: PressEvent) => Promise<void>;
    onUnpublish: (e: PressEvent) => Promise<void>;
    onDelete: (e: PressEvent) => Promise<void>;
  }) => {
    const { store } = props;
    const l = store.lottery;
    const isSubmitting = store.state !== LoadingState.IDLE;

    return (
      <Form className="flex flex-col gap-4">
        <h3>General information</h3>
        <div className="flex gap-4 w-full">
          <JollyTextField className="flex-1 bg-grey" label="ID" value={l.id} isReadOnly />
          <JollyTextField
            className="flex-1"
            label="Creator"
            value={store.creator?.name || 'Loading...'}
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
        <JollyTextField
          label="Repeat interval"
          value={store.repeatInterval}
          isInvalid={!!store.validationErrors.repeatInterval}
          errorMessage={store.validationErrors.repeatInterval}
          onChange={action((v) => {
            store.repeatInterval = v;
            if (v == null || v.trim() == '') {
              store.parsedRepeatInterval = 0;
              return;
            }
            try {
              let input = v.trim().replaceAll(',', '');
              // Default a unit-less number to "days"
              if (!isNaN(Number(input))) {
                input += 'd';
              }
              const duration = timespan.parse(input, 'ms');
              store.parsedRepeatInterval = duration;
              store.validationErrors.repeatInterval = undefined;
            } catch (e) {
              // Could not parse - mark as error field
              store.validationErrors.repeatInterval = 'Could not parse repeat interval';
            }
          })}
          onBlur={() => {
            if (store.validationErrors.repeatInterval == null) {
              l.repeatInterval = store.parsedRepeatInterval;
            }
          }}
        />
        <h3>Restrictions</h3>
        <div className="flex gap-4 w-full">
          <JollyTextField
            className="flex-1"
            label="Role IDs needed to participate"
            value={l.roles?.join('\n') || ''}
            onChange={action((v) => (l.roles = v.split('\n').map((l) => l.trim())))}
            textArea
          />
          <JollyNumberField
            label="Max bids per user"
            className="flex-1"
            value={l.maxBidsPerUser}
            onChange={action((v) => (l.maxBidsPerUser = v))}
          />
        </div>
        {l.lotteryType === LotteryType.LOWEST_UNIQUE_NUMBER && (
          <div className="flex gap-4 w-full">
            <JollyNumberField
              label="Max winners"
              value={l.winnerCount}
              onChange={action((v) => (l.winnerCount = v))}
            />
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
        )}
        {props.store.error != null && (
          <div className="w-full bg-red-600 rounded-md text-white my-4 p-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {props.store.error as any}
          </div>
        )}
        <div className="flex gap-2">
          <JollyButton isDisabled={isSubmitting} onPress={props.onSave}>
            💾 Save
            {props.store.state === LoadingState.SAVING && (
              <Loader2 className="ml-2 size-4 animate-spin" />
            )}
          </JollyButton>

          {props.isDraft ? (
            <JollyButton isDisabled={isSubmitting} variant="secondary" onPress={props.onPublish}>
              ✅ Save & Publish
              {props.store.state === LoadingState.PUBLISHING && (
                <Loader2 className="ml-2 size-4 animate-spin" />
              )}
            </JollyButton>
          ) : (
            <JollyButton isDisabled={isSubmitting} variant="secondary" onPress={props.onUnpublish}>
              🚫 Save & Unpublish
              {props.store.state === LoadingState.UNPUBLISHING && (
                <Loader2 className="ml-2 size-4 animate-spin" />
              )}
            </JollyButton>
          )}
        </div>
        <div className="flex gap-2 my-4">
          <DialogTrigger>
            <JollyButton isDisabled={isSubmitting} variant="destructive">
              🗑️ Delete
            </JollyButton>
            <DialogOverlay>
              <DialogContent>
                {({ close }) => (
                  <>
                    <DialogHeader>Are you sure?</DialogHeader>
                    <div className="flex gap-2">
                      <JollyButton
                        isDisabled={isSubmitting}
                        variant="destructive"
                        onPress={props.onDelete}
                      >
                        Yes, delete
                        {props.store.state === LoadingState.DELETING && (
                          <Loader2 className="ml-2 size-4 animate-spin" />
                        )}
                      </JollyButton>
                      <JollyButton isDisabled={isSubmitting} onPress={close}>
                        Cancel
                      </JollyButton>
                    </div>
                  </>
                )}
              </DialogContent>
            </DialogOverlay>
          </DialogTrigger>
        </div>
      </Form>
    );
  }
);
