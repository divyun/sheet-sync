const hooks = {
  record: {},
  replay: {},
};


/**
 * After Change Hooks
 */

hooks.record.afterChange = (pubnub, sheetName) => function recordAfterChange(
  changes,
  source,
) {
  if (source === 'sync' || !changes) {
    return;
  }

  changes.reduce(async (prev, [row, prop, oldValue, newValue]) => {
    await prev;
    return pubnub.publish({
      message: {
        operation: 'afterChange',
        delta: {
          row, prop, oldValue, newValue,
        },
      },
      channel: sheetName,
    });
  }, true);
};

hooks.replay.afterChange = function replayAfterChange(hot, {
  row, prop, newValue,
}) {
  hot.setDataAtCell(row, hot.propToCol(prop), newValue, 'sync');
};

/**
 * After Create Row Hook
 */

hooks.record.afterCreateRow = (pubnub, sheetName) => function afterCreateRow(
  index,
  amount,
  source,
) {
  if (source === 'sync') {
    return;
  }

  pubnub.publish({
    message: { operation: 'afterCreateRow', delta: { index, amount } },
    channel: sheetName,
  });
};

hooks.replay.afterCreateRow = (hot, {
  index, amount,
}) => {
  hot.alter('insert_row', index, amount, 'sync');
};


/**
 * After Remove Row Hook
 */

hooks.record.afterRemoveRow = (pubnub, sheetName) => function afterRemoveRow(
  index,
  amount,
  source,
) {
  if (source === 'sync' || source === 'ObserveChanges.change') {
    return;
  }
  pubnub.publish({
    message: { operation: 'afterRemoveRow', delta: { index, amount } },
    channel: sheetName,
  });
};

hooks.replay.afterRemoveRow = (hot, {
  index, amount,
}) => {
  hot.alter('remove_row', index, amount, 'sync');
};

/**
 * After Column Sort Hook
 */

let lastSortFromSync;

hooks.record.afterColumnSort = (pubnub, sheetName) => function afterColumnSort(
  [currentSortConfig],
  [destinationSortConfig],
) {
  if (lastSortFromSync === destinationSortConfig) {
    return;
  }

  if (
    lastSortFromSync && destinationSortConfig
    && lastSortFromSync.column === destinationSortConfig.column
    && lastSortFromSync.sortOrder === destinationSortConfig.sortOrder
  ) {
    return;
  }

  pubnub.publish({
    message: { operation: 'afterColumnSort', delta: { currentSortConfig, destinationSortConfig } },
    channel: sheetName,
  });
};

hooks.replay.afterColumnSort = (hot, {
  destinationSortConfig,
}) => {
  lastSortFromSync = destinationSortConfig;
  if (!destinationSortConfig) {
    hot.getPlugin('columnSorting').clearSort();
    return;
  }
  hot.getPlugin('columnSorting').sort(destinationSortConfig);
};

export default hooks;
