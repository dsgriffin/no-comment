import "jquery-ui";
import "datatables";
import { UserSettings } from "./interfaces";

// SET jQuery UI options display
$('#radio').buttonset();

// @ts-ignore
$('#visualDisplay').selectmenu({ 'width': 'auto' });

$('#saveSettings, #saveAllowList, #saveBlockList').button({ icons: { 'primary': 'ui-icon-locked' } }).css('width', '240px');

$('[data-list="addNew"]').button({ icons: { 'primary': 'ui-icon-plus' } });
$('[data-list="modifySelected"]').button({ icons: { 'primary': 'ui-icon-gear' } });
$('[data-list="removeSelected"]').button({ icons: { 'primary': 'ui-icon-minus' } });
$('[data-list="removeAll"]').button({ icons: { 'primary': 'ui-icon-close' } });

// SET Allow List and Block List DataTables initialisation/customization.
$('#allowlist, #blocklist').DataTable({ 'scrollY': '200px', 'paging': false, 'jQueryUI': true });

$('div.accordion').accordion({ heightStyle: 'content', collapsible: false });

chrome.storage.sync.get({
  blockAllComments: false,
  display: 'collapse',
  allowlist: [],
  blocklist: []
}, (optionsStorage: UserSettings): void => {
  // SET: Data of both lists + options panel settings.
  let allowlist = $('#allowlist').DataTable();
  let blocklist = $('#blocklist').DataTable();

  for (let i of optionsStorage.allowlist.keys()) {
    allowlist.row.add(optionsStorage.allowlist[i]);
  }
  for (let i of optionsStorage.blocklist.keys()) {
    blocklist.row.add(optionsStorage.blocklist[i]);
  }

  allowlist.draw();
  blocklist.draw();

  $('#radio1').prop('checked', !optionsStorage.blockAllComments).button('refresh');
  $('#radio2').prop('checked', optionsStorage.blockAllComments).button('refresh');
  $('#visualDisplay').val(optionsStorage.display).selectmenu('refresh');
});

// GET user-related extension storage preferences.
// Add vertical tabs class.
chrome.storage.local.get('currentTabIndex', function (obj) {
  $('#tabs').tabs({
    active: obj.currentTabIndex,
    activate: (event, ui) => {
      $('#allowlist').DataTable().columns.adjust();
      $('#blocklist').DataTable().columns.adjust();

      chrome.storage.local.set({ 'currentTabIndex': ui.newPanel[0].dataset.tabIndex });
    }
  }).addClass('ui-tabs-vertical ui-helper-clearfix');
});

// When a row is selected, adjust option buttons as appropriate.
$('#allowlist tbody, #blocklist tbody').on('click', 'tr', function () {
  $(this).toggleClass('selected');
  $('[data-list="modifySelected"][data-list-type=' + $(this).closest('table').attr('id') + ']').button('option', 'disabled', $(this).closest('table').find('.selected').length !== 1);
  $('[data-list="removeSelected"][data-list-type=' + $(this).closest('table').attr('id') + ']').button('option', 'disabled', $(this).closest('table').find('.selected').length !== 1);
});

// SET: When the user saves their general settings, send these settings off to storage for later retrieval.
$('#saveSettings').on('click', function () {
  chrome.storage.sync.set({
    'blockAllComments': $('#radio1').prop('checked'),
    'display': $('#visualDisplay').val()
  }, () => {
    // Update status to let user know options were saved.
    $(this).next('h5.notification-alert').text('Your settings have been saved successfully.');
    $(this).next('h5.notification-alert').slideDown(1000).delay(4000).slideUp(1000, () => {
      $(this).next('h5.notification-alert').text('');
    });
  });
});

// SET: When the user saves their Allow List, send these settings off to storage for later retrieval.
$('#saveAllowList').on('click', function () {
  const allowlist = [];

  $('#allowlist').DataTable().rows().data().each(function (value, index) {
    allowlist[index] = value;
  });

  chrome.storage.sync.set({ 'allowlist': allowlist }, () => {
    $(this).next('h5.notification-alert').text('Your Allow List has been saved successfully.');
    $(this).next('h5.notification-alert').slideDown(1000).delay(4000).slideUp(1000, () => {
      $(this).next('h5.notification-alert').text('');
    });
  });
});

// SET: When the user saves their Block List, send these settings off to storage for later retrieval.
$('#saveBlockList').on('click', function () {
  const blocklist = [];

  $('#blocklist').DataTable().rows().data().each(function (value, index) {
    blocklist[index] = value;
  });

  chrome.storage.sync.set({ 'blocklist': blocklist }, () => {
    $(this).next('h5.notification-alert').text('Your Block List has been saved successfully.');
    $(this).next('h5.notification-alert').slideDown(1000).delay(4000).slideUp(1000, () => {
      $(this).next('h5.notification-alert').text('');
    });
  });
});

// SET: When the user saves a new list entry, process this.
$('[data-list="addNew"]').on('click', function () {
  const listType = ($(this).data('listType') === 'allowlist') ? 'Allow List' : 'Block List';

  $('<div></div>')
    .append(`<p>Enter a valid URL/URL pattern:</p>
             <input type="url" id="newListItem" class="ui-corner-all" style="width:240px;" placeholder="www.example.com"/>`)
    .dialog({
      modal: true,
      title: `Add new URL/URL pattern to ${listType}`,
      buttons:
        [{
          text: 'Add New',
          icons: { primary: 'ui-icon-circle-check' },
          click: function () {
            $('#' + listType.replace(/\s/g, '').toLowerCase()).DataTable().row.add([$('#newListItem').val()]).draw();
            $(this).dialog('destroy');
          }
        },
        {
          text: 'Cancel',
          icons: { primary: 'ui-icon-closethick' },
          click: function () { $(this).dialog('destroy'); }
        }],
      // @ts-ignore
      maxWidth: 'auto',
    });
});

// SET: When the user modifies a list entry, process this.
$('[data-list="modifySelected"]').on('click', function () {
  const listType = ($(this).data('listType') === 'allowlist') ? 'Allow List' : 'Block List';

  let selectedRow = $('#' + listType.replace(/\s/g, '').toLowerCase()).DataTable().row('tr.selected:first');

  $('<div></div>')
    .append(`<p>Modify the entry below:</p>
             <input type="url" id="modifiedItem" class="ui-corner-all" style="width:240px;" value="${selectedRow.data()[0]}"/>`)
    .dialog({
      modal: true,
      title: `Modify ${listType} entry`,
      buttons:
        [{
          text: 'Save Changes',
          icons: { primary: 'ui-icon-circle-check' },
          click: function () {
            selectedRow.data([$('#modifiedItem').val()]);
            $(this).dialog('destroy');
          }
        },
        {
          text: 'Cancel',
          icons: { primary: 'ui-icon-closethick' },
          click: function () { $(this).dialog('destroy'); }
        }]
    });
});

// SET: When the user deletes a list entry/entries, process this.
$('[data-list="removeSelected"]').on('click', function () {
  const listType = ($(this).data('listType') === 'allowlist') ? 'Allow List' : 'Block List';

  let selectedRows = $('#' + listType.replace(/\s/g, '').toLowerCase()).DataTable().rows('tr.selected');

  $('<div></div>')
    .append('<p>Are you sure you want to remove the selected ' + listType + ' entry/entries?</p>')
    .dialog({
      modal: true,
      title: `Remove ${listType} entry`,
      buttons:
        [{
          text: 'Remove',
          icons: { primary: 'ui-icon-alert' },
          click: function () {
            selectedRows.remove().draw();
            $(this).dialog('destroy');
          }
        },
        {
          text: 'Cancel',
          icons: { primary: 'ui-icon-closethick' },
          click: function () { $(this).dialog('destroy'); }
        }]
    });
});

// SET: When the user removes all list entries, process this.
$('[data-list="removeAll"]').on('click', function () {
  const listType = ($(this).data('listType') === 'allowlist') ? 'Allow List' : 'Block List';

  let allRows = $('#' + listType.replace(/\s/g, '').toLowerCase()).DataTable().rows();

  $('<div></div>')
    .append('<p>Are you sure you want to remove all entries in the ' + listType + '?</p>')
    .dialog({
      modal: true,
      title: `Remove all ${listType} entries`,
      buttons:
        [{
          text: 'Remove All',
          icons: { primary: 'ui-icon-alert' },
          click: function () {
            allRows.clear().draw();
            $(this).dialog('destroy');
          }
        },
        {
          text: 'Cancel',
          icons: { primary: 'ui-icon-closethick' },
          click: function () { $(this).dialog('destroy'); }
        }]
    });
});
