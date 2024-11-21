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
} from '@/db/db_actions';
import { Lottery, LotterySchema, LotteryType, lotteryTypeLabels } from '@/db/schema';
import { getDiscordUser } from '@/discord/discord_client_actions';
import { getLocalTimeZone, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { Loader2 } from 'lucide-react';
import { action, observable, runInAction, toJS } from 'mobx';
import * as mobxReact from 'mobx-react';
import dynamic from 'next/dynamic';
import React from 'react';
import { Form, PressEvent } from 'react-aria-components';

const enum LoadingState {
  IDLE,
  SAVING,
  PUBLISHING,
  UNPUBLISHING,
  DELETING,
}

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
};

export const LotteryView = (props: { isDraft: boolean; lottery: Lottery }) => {
  const store = observable<Store>({
    lottery: props.lottery,
    creator: undefined,
    state: LoadingState.IDLE,
    error: undefined,
  });

  const onSave = async () => {
    runInAction(() => (store.state = LoadingState.SAVING));
    await saveLottery(toJS(store.lottery));
    runInAction(() => (store.state = LoadingState.IDLE));
  };

  const onPublish = async () => {
    runInAction(() => (store.state = LoadingState.PUBLISHING));
    try {
      await saveLottery(toJS(store.lottery), true);
      await tryPublishLottery(store.lottery.id);
    } catch (e) {
      runInAction(() => {
        store.state = LoadingState.IDLE;
        store.error = e;
      });
    }
    // Redirect to new promoted lottery page
    window.location.reload();
  };

  const onUnpublish = async () => {
    runInAction(() => (store.state = LoadingState.UNPUBLISHING));
    try {
      await saveLottery(toJS(store.lottery), true);
      await tryUnpublishLottery(store.lottery.id);
    } catch (e) {
      runInAction(() => {
        store.state = LoadingState.IDLE;
        store.error = e;
      });
    }
    // Redirect to new draft lottery page
    window.location.reload();
  };

  const onDelete = async () => {
    runInAction(() => (store.state = LoadingState.DELETING));
    try {
      await tryDeleteLottery(store.lottery.id);
    } catch (e) {
      runInAction(() => {
        store.state = LoadingState.IDLE;
        store.error = e;
      });
    }
    // Redirect to new draft lottery page
    window.location.href = '/lottery';
  };

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
    const l = props.store.lottery;
    const isSubmitting = props.store.state !== LoadingState.IDLE;

    return (
      <Form className="flex flex-col gap-4">
        <div className="flex gap-4 w-full">
          <JollyTextField className="flex-1 bg-grey" label="ID" value={l.id} isReadOnly />
          <JollyTextField
            className="flex-1"
            label="Creator"
            value={props.store.creator?.name || 'Loading...'}
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
              ✅ Publish
              {props.store.state === LoadingState.PUBLISHING && (
                <Loader2 className="ml-2 size-4 animate-spin" />
              )}
            </JollyButton>
          ) : (
            <JollyButton isDisabled={isSubmitting} variant="secondary" onPress={props.onUnpublish}>
              🚫 Unpublish
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
