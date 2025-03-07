// Handles the insertion of the "Create alert" option in the dropdown menu
const addAlertButtonInRecapAction = (court, pacerCaseId) => {
  let dropdownHeader = document.getElementById('action-button-dropdown-header');
  if (!dropdownHeader) {
    return;
  }
  let existingAlertButton = document.getElementById('create-alert-button');
  if (!existingAlertButton) {
    let alertLi = document.createElement('li');
    alertLi.setAttribute('id', 'create-alert-button');
    let createAlert = document.createElement('a');

    const url = new URL('https://www.courtlistener.com/alert/docket/new/');
    url.searchParams.append('pacer_case_id', pacerCaseId);
    url.searchParams.append('court_id', court);

    createAlert.href = url.toString();
    createAlert.innerHTML = 'Create alert';
    createAlert.setAttribute('target', '_blank');
    alertLi.appendChild(createAlert);
    dropdownHeader.after(alertLi);
  }
};

// Handles the insertion of the "Search this docket" option in the dropdown menu
const addSearchDocketInRecapAction = (cl_id) => {
  let viewDocketButton = document.getElementById('view-docket-button');
  if (!viewDocketButton) {
    return;
  }
  let existingSearchButton = document.getElementById('search-docket-button');
  if (!existingSearchButton) {
    let docketLi = document.createElement('li');
    docketLi.setAttribute('id', 'search-docket-button');
    let searchDocket = document.createElement('a');
    searchDocket.innerHTML = 'Search this Docket';
    searchDocket.href = `https://www.courtlistener.com/?type=r&q=docket_id%3A${cl_id}`;
    searchDocket.setAttribute('target', '_blank');
    docketLi.appendChild(searchDocket);
    viewDocketButton.before(docketLi);
  }
};

// creates the dropdown menu content
const recapDropdownMenu = (court, pacerCaseId) => {
  let dropdownWrapper = document.createElement('ul');
  dropdownWrapper.classList.add('dropdown-menu');

  let groupHeader = document.createElement('h2');
  groupHeader.classList.add('dropdown-header');
  groupHeader.setAttribute('id', 'action-button-dropdown-header');
  groupHeader.innerHTML = 'CourtListener';
  dropdownWrapper.appendChild(groupHeader);

  let viewOnClLi = document.createElement('li');
  viewOnClLi.setAttribute('id', 'view-docket-button');
  let viewOnCl = document.createElement('a');
  viewOnCl.innerHTML = 'View this docket';
  viewOnCl.href = `https://www.courtlistener.com/recap/gov.uscourts.${court}.${pacerCaseId}/`;
  viewOnCl.setAttribute('target', '_blank');
  viewOnClLi.appendChild(viewOnCl);
  dropdownWrapper.appendChild(viewOnClLi);

  let divider2 = document.createElement('div');
  divider2.classList.add('recap-dropdown-divider');
  dropdownWrapper.appendChild(divider2);

  let checkLi = document.createElement('li');
  let checkDoc = document.createElement('a');
  checkDoc.innerHTML = 'Refresh RECAP Links';
  checkDoc.setAttribute('href', 'javascript:void(0);');
  checkDoc.setAttribute('id', 'refresh-recap-links');
  checkDoc.setAttribute('role', 'button');

  checkDoc.addEventListener('click', () => {
    let links = document.querySelectorAll('.recap-inline, .recap-inline-appellate');
    links.forEach((link) => {
      link.remove();
    });
    let spinner = document.getElementById('recap-button-spinner');
    if (spinner) {
      spinner.classList.remove('recap-btn-spinner-hidden');
    }
    getTabIdForContentScript().then((msg) => {
      addRecapInformation(msg);
    });
  });

  checkLi.appendChild(checkDoc);
  dropdownWrapper.appendChild(checkLi);

  return dropdownWrapper;
};

// creates a single button with a dropdown toggle menu
const recapActionsButton = (court, pacerCaseId) => {
  const mainDiv = document.createElement('div');
  mainDiv.classList.add('btn-group');
  mainDiv.setAttribute('id', 'recap-action-button');

  const spinner = createRecapSpinner();

  const mainButton = document.createElement('a');
  mainButton.classList.add('btn', 'btn-primary', 'dropdown-toggle');
  mainButton.innerHTML = `${spinner.outerHTML} RECAP Actions`;
  mainButton.setAttribute('data-toggle', 'dropdown');
  mainButton.setAttribute('aria-haspopup', true);
  mainButton.setAttribute('aria-expanded', false);

  const caret = document.createElement('span');
  caret.classList.add('caret');

  hiddenDropdown = recapDropdownMenu(court, pacerCaseId);

  mainButton.appendChild(caret);
  mainDiv.appendChild(mainButton);
  mainDiv.appendChild(hiddenDropdown);

  return mainDiv;
};
