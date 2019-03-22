import Handsontable from 'handsontable';
import faker from 'faker';

import './styles';
import pubnub from './connectors/pubnub';
import hooks from './hooks';
import user from './user';

const searchParams = new window.URLSearchParams(window.location.search);

const sheetName = searchParams.get('sheet') || 'test_sheet';

if (!searchParams.get('sheet')) {
  const path = `${window.location.protocol}//${window.location.host}${window.location.pathname}?sheet=test_sheet`;
  window.history.pushState({ path }, '', path);
}

document.getElementById('sheet-name').innerHTML = sheetName;
document.getElementById('user')
  .innerHTML = `<div class="flex items-baseline">
    Welcome, ${user.name}
    <span
      class="contact__avatar w-6 h-6 m-2 flex flex-no-shrink justify-center items-center bg-center bg-no-repeat bg-cover text-xl text-white font-semibold uppercase text-center rounded-full"
      style="background-color: ${user.color || 'grey'}"
    >
      ${user.name[0]}
    </span>
  </div>`;

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
  rowHeaders: true,
  colHeaders: [
    '',
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
  colWidths: ['7%', '16%', '38%', '39%'],
  className: 'sheet',
};

const hotElement = document.querySelector('#hot');

const hot = new Handsontable(hotElement, hotSettings);

document.getElementById('seed-data').addEventListener('click', () => {
  hot.populateFromArray(data.length, 0, [[
    faker.random.boolean(),
    faker.random.number(),
    faker.internet.email(),
    faker.name.findName(),
  ]]);
});

/**
 * Record user's activity as pubunb's state
 */

hot.addHook('afterSelectionEnd', (row, col, row2, col2) => {
  pubnub.setState(
    {
      state: {
        selection: {
          row, col, row2, col2,
        },
        user,
      },
      channels: [sheetName],
    },
  );
});

hot.addHook('afterDeselect', () => {
  pubnub.setState(
    {
      state: {
        selection: null,
        user,
      },
      channels: [sheetName],
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

function fetchPresense() {
  pubnub.hereNow(
    {
      channels: [sheetName],
      includeUUIDs: true,
      includeState: true,
    },
    (status, { channels: { test_sheet: { occupants } } }) => {
      customBordersPlugin.clearBorders();
      const sessions = new Set();
      const html = occupants.reduce((acc, { state = {} }) => {
        if (!state.user || (state.user.uuid === user.uuid) || sessions.has(state.user.uuid)) {
          return acc;
        }

        sessions.add(state.user.uuid);

        if (state.selection) {
          setBorders(state.selection, state.user.color);
        }

        return `${acc}
          <span
            class="contact__avatar w-6 h-6 m-1 flex flex-no-shrink justify-center items-center bg-center bg-no-repeat bg-cover text-xl text-white font-semibold uppercase text-center rounded-full"
            style="background-color: ${state.user.color || 'grey'}"
            > ${state.user.name[0]} </span>`;
      }, '');

      document.getElementById('online-users').innerHTML = html;
    },
  );
}

const history = [];

function renderHistory() {
  history.splice(7);

  const html = history.reduce((acc, { timetoken, entry }) => `${acc}
    <div class="hover:bg-indigo-lightest border-b border-grey-light cursor-pointer" id="event-${timetoken}">
      <div class="py-2 px-6 border-grey-light text-xs" id="event-${timetoken}__operation">
        ${entry.operation.replace(/([A-Z])/g, ' $1').replace('after ', '')}
        <small id="event-${timetoken}__timestamp">at ${timetoken}</small>
      </div>
      <div class="py-2 px-6 border-grey-light text-xs hidden bg-grey-lighter" id="event-${timetoken}__delta-container">
        <pre id="event-${timetoken}__delta">${JSON.stringify(entry.delta, null, 1)}</pre>
      </div>
    </div>`, '');

  document.getElementById('history-table__body').innerHTML = html;
}

document.getElementById('clear-data').addEventListener('click', () => {
  data.length = 0;
  history.length = 0;
  pubnub.deleteMessages({
    channel: sheetName,
  }, renderHistory);
  pubnub.publish({
    channel: sheetName,
    message: { operation: 'afterClearHistory' },
  });
});

document.getElementById('history-table__body').addEventListener('click', ({ target: { id } }) => {
  const deltaEl = document.getElementById(id.replace(/operation|timestamp|delta/g, 'delta-container'));
  deltaEl.classList.toggle('hidden');
});

/**
 * Listen for document and state changes
 */

pubnub.addListener({
  message({ publisher, message: { operation, delta }, timetoken }) {
    if (publisher !== pubnub.getUUID()) {
      if (operation === 'afterClearHistory') {
        data.length = 0;
        history.length = 0;
        hot.render();
      } else {
        hooks.replay[operation](hot, delta);
      }
    }

    history.unshift({ entry: { operation, delta }, timetoken });
    renderHistory();
  },
  presence({ uuid }) {
    if (uuid === pubnub.getUUID()) {
      return;
    }
    fetchPresense();
  },
});


/**
 * Fetch Previous Logs and replay before subscriptions
 */

pubnub.history({
  channel: [sheetName],
}, (status, { messages }) => {
  messages.forEach((message) => {
    history.unshift(message);
    hooks.replay[message.entry.operation](hot, message.entry.delta);
  });

  renderHistory();

  pubnub.subscribe({
    channels: [sheetName],
    withPresence: true,
  });

  pubnub.setState(
    {
      state: {
        selection: null,
        user,
      },
      channels: [sheetName],
    },
  );

  Object.keys(hooks.record).forEach((hook) => {
    hot.addHook(hook, hooks.record[hook](pubnub, sheetName));
  });

  fetchPresense();

  /**
   * Hide Loader
   */

  document.getElementById('loader').classList.remove('flex');
  document.getElementById('loader').classList.add('hidden');
});
