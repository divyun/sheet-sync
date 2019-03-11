import './styles';

import Handsontable from 'handsontable';
import faker from 'faker';

import 'handsontable/dist/handsontable.full.min.css';

import pubnub from './connectors/pubnub';

const hotElement = document.querySelector('#hot');

const data = [];

const hotSettings = {
  data,
  columns: [
    {
      data: 'available',
      type: 'checkbox',
    },
    {
      data: 'id',
      type: 'numeric',
    },
    {
      data: 'email',
      type: 'text',
    },
    {
      data: 'fullName',
      type: 'text',
    },
  ],
  stretchH: 'all',
  autoWrapRow: true,
  dropdownMenu: true,
  rowHeaders: true,
  colHeaders: [
    'Available',
    'Id',
    'Email',
    'Name',
  ],
  columnSorting: {
    indicator: true,
  },
  autoColumnSize: {
    samplingRatio: 23,
  },
  contextMenu: true,
  licenseKey: 'non-commercial-and-evaluation',
  customBorders: true,
};

const userColor = faker.internet.color(160, 160, 160);

const hot = new Handsontable(hotElement, hotSettings);

const pubnubHooks = {};

hot.addHook('afterChange', (changes, source) => {
  if (source === 'sync') {
    return;
  }
  changes.forEach(([row, prop, oldValue, newValue]) => pubnub.publish({
    message: {
      operation: 'afterChange',
      delta: {
        row, prop, oldValue, newValue,
      },
    },
    channel: 'test_sheet',
  }));
});

pubnubHooks.afterChange = ({
  row, prop, newValue,
}) => {
  hot.setDataAtCell(row, hot.propToCol(prop), newValue, 'sync');
};

hot.addHook('afterCreateRow', (index, amount, source) => {
  if (source === 'sync') {
    return;
  }
  pubnub.publish({
    message: { operation: 'afterCreateRow', delta: { index, amount } },
    channel: 'test_sheet',
  });
});

pubnubHooks.afterCreateRow = ({
  index, amount,
}) => {
  hot.alter('insert_row', index, amount, 'sync');
};

hot.addHook('afterRemoveRow', (index, amount, source) => {
  if (source === 'sync') {
    return;
  }
  pubnub.publish({
    message: { operation: 'afterRemoveRow', delta: { index, amount } },
    channel: 'test_sheet',
  });
});

pubnubHooks.afterRemoveRow = ({
  index, amount,
}) => {
  hot.alter('remove_row', index, amount, 'sync');
};

hot.addHook('afterColumnSort', ([currentSortConfig], [destinationSortConfig]) => {
  if (currentSortConfig === destinationSortConfig) {
    return;
  }

  if (
    currentSortConfig && destinationSortConfig
    && currentSortConfig.column === destinationSortConfig.column
    && currentSortConfig.sortOrder === destinationSortConfig.sortOrder
  ) {
    return;
  }

  pubnub.publish({
    message: { operation: 'afterColumnSort', delta: { currentSortConfig, destinationSortConfig } },
    channel: 'test_sheet',
  });
});

pubnubHooks.afterColumnSort = ({
  destinationSortConfig,
}) => {
  if (!destinationSortConfig) {
    hot.getPlugin('columnSorting').clearSort();
    return;
  }
  hot.getPlugin('columnSorting').sort(destinationSortConfig);
};

hot.addHook('afterSelectionEnd', (row, col, row2, col2) => {
  pubnub.setState(
    {
      state: {
        selection: {
          row, col, row2, col2,
        },
        userColor,
      },
      channels: ['test_sheet'],
    },
  );
});

hot.addHook('afterDeselect', () => {
  pubnub.setState(
    {
      state: {
        selection: null, userColor,
      },
      channels: ['test_sheet'],
    },
  );
});

const customBordersPlugin = hot.getPlugin('customBorders');

function setBorders({
  row, col, row2, col2,
}, color) {
  customBordersPlugin.setBorders([[row, col, row, col2]], {
    top: { width: 2, color },
  });

  customBordersPlugin.setBorders([[row2, col, row2, col2]], {
    bottom: { width: 2, color },
  });

  customBordersPlugin.setBorders([[row, col, row2, col]], {
    left: { width: 2, color },
  });

  customBordersPlugin.setBorders([[row, col2, row2, col2]], {
    right: { width: 2, color },
  });
}

document.getElementById('seed-data').addEventListener('click', () => {
  hot.populateFromArray(data.length, 0, [[
    faker.random.boolean(),
    faker.random.number(),
    faker.internet.email(),
    faker.name.findName(),
  ]] /* undefined, undefined, 'sync' */);
});

function fetchPresense() {
  pubnub.hereNow(
    {
      channels: ['test_sheet'],
      includeUUIDs: true,
      includeState: true,
    },
    (status, { channels: { test_sheet: { occupants } } }) => {
      customBordersPlugin.clearBorders();
      const html = occupants.reduce((acc, { state = {}, uuid }) => {
        if (uuid === pubnub.getUUID()) {
          return acc;
        }

        if (state.selection) {
          setBorders(state.selection, state.userColor);
        }

        return `${acc}
          <span
            class="contact__avatar w-6 h-6 m-1 flex flex-no-shrink justify-center items-center bg-center bg-no-repeat bg-cover text-xl text-white font-semibold uppercase text-center rounded-full"
            style="background-color: ${state.userColor || 'grey'}"
          > </span>`;
      }, '');

      document.getElementById('online-users').innerHTML = html;
    },
  );
}

pubnub.addListener({
  message({ publisher, message: { operation, delta } }) {
    if (publisher !== pubnub.getUUID()) {
      pubnubHooks[operation](delta);
    }
  },
  presence({ uuid }) {
    if (uuid === pubnub.getUUID()) {
      return;
    }
    fetchPresense();
  },
});

pubnub.subscribe({
  channels: ['test_sheet'],
  withPresence: true,
});

fetchPresense();
