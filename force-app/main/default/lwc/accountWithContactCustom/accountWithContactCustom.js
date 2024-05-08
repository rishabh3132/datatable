import { LightningElement, track, wire } from 'lwc';
import getAccountData from '@salesforce/apex/AccountDemoController.getAccountData';
import getRequiredField from '@salesforce/apex/AccountDemoController.getRequiredField';
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import ACCOUNT_OBJECT from "@salesforce/schema/Account";
import CONTACT_OBJECT from "@salesforce/schema/Contact";
import { refreshApex } from '@salesforce/apex';
import { deleteRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
export default class CustomDatatable extends LightningElement {
    accountResult;
    @track accountData = [];
    initialAccountLength = 0;
    @track initialAccounts = [];
    sortBy = '';
    sortDirection = '';
    sortByAccount = '';
    sortDirectionAccount = '';
    contactId;
    accountId;
    mode;
    accountTableHeader = [];
    contactTableHeader = []
    accountFieldApiNames = [];
    contactFieldApiNames = [];
    isReadOnly;
    dataType = '';
    showViewEditModal = false;
    showAccountEditForm = false;
    recordPerPage = 5;
    recordPerPageList = [5, 10, 20, 50];
    pageNumber = 1;
    contactFieldApi;
    contactSortOrder;
    @track contacts = [];
    get recordPageOptions() {
        return this.recordPerPageList.map(rec => {
            return { label: rec, value: rec };
        });
    }
    @wire(getRequiredField)
    wireGetRequiredField({ data, error }) {
        if (data) {
            this.contactRequiredFields = data;
        } else {
        }
    }

    @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT, apiName: '$accountFieldApiNames' })
    accountObjectInfo({ data, error }) {
        if (data) {
            let { fields } = data;
            let headerColumn = this.accountFieldApiNames.filter(col => {
                return (col != 'Id' && col != 'Contacts');
            })
            this.accountTableHeader = headerColumn.map(col => {
                let { label, apiName, dataType } = fields[col];
                return { label, apiName, dataType };
            })
        }
    }

    @wire(getObjectInfo, { objectApiName: CONTACT_OBJECT, apiName: '$contactFieldApiNames' })
    contactObjectInfo({ data, error }) {
        if (data) {
            let { fields } = data;
            let headerColumn = this.contactFieldApiNames.filter(col => {
                return (col != 'Id' && col != 'AccountId' && col != 'Name');
            })
            this.contactTableHeader = headerColumn.map(col => {
                let { label, apiName } = fields[col];
                return { label, apiName };
            })
        } else {
        }
    }

    showInitialAccount() {
        this.initialAccounts = this.accountData.slice((this.pageNumber - 1) * this.recordPerPage, this.recordPerPage * this.pageNumber);
        this.initialAccountLength = this.initialAccounts.length;
    }

    @wire(getAccountData)
    wireAccountData(result) {
        this.accountResult = result;
        if (result.data) {
            let contactFields = new Set()
            let accountFields = new Set();
            this.accountData = result.data.map(acc => {
                Object.keys(acc).forEach(a => {
                    accountFields.add(a);
                })
                let accountLink = `/${acc.Id}`
                let contactSize = acc.Contacts?.length > 0 ? acc.Contacts.length : 0;
                let title = `${acc.Name}(${contactSize})`;
                if (contactSize > 0) {
                    acc.Contacts.forEach(con => {
                        Object.keys(con).forEach(field => {
                            contactFields.add(field);
                        })
                    })
                }
                return { ...acc, title, contactSize, accountLink };
            });
            this.accountFieldApiNames = [...accountFields];
            this.contactFieldApiNames = [...contactFields];
            this.showInitialAccount();
        }
    }
    get showTable() {
        return (this.initialAccountLength > 0 && this.accountTableHeader.length > 0);
    }
    showToastMessage(title, message, variant) {
        let evt = new ShowToastEvent({ title, message, variant })
        this.dispatchEvent(evt);
    }
    closeContactHandler() {
        this.showViewEditModal = false;
    }
    get header() {
        return this.mode == 'edit' ? `Contact Edit` : `Contact View`
    }
    async handleContactSuccess() {
        this.showViewEditModal = false;
        await refreshApex(this.accountResult);
        let accountDetails = this.accountData.find(acc => acc.Id == this.accountId);
        this.contacts = accountDetails.contactSize > 0 ? accountDetails.Contacts : [];
        this.showToastMessage('Success', 'Contact Updated', 'success')
    }
    openRelatedContacts(event) {
        let previousAccountId = this.accountId;
        this.accountId = event.currentTarget.dataset.accountId;
        if (event.target.iconName == 'utility:chevronright') {
            event.target.iconName = 'utility:chevrondown';
            let accountDetails = this.accountData.find(acc => acc.Id == this.accountId);
            this.contacts = accountDetails.contactSize > 0 ? accountDetails.Contacts : [];
        } else {
            event.target.iconName = 'utility:chevronright';
        }
        if (previousAccountId && previousAccountId != this.accountId) {
            let closeToggleButton = this.template.querySelector(`lightning-button-icon[data-account-id="${previousAccountId}"]`);
            closeToggleButton.iconName = 'utility:chevronright';
        }
        const contactTables = Array.from(this.template.querySelectorAll('.display-none'));
        contactTables.forEach(tab => {
            const shouldDisplay = tab.dataset.accountId === this.accountId && tab.style.display !== 'table-row';
            tab.style.display = shouldDisplay ? 'table-row' : 'none';
        });
        this.contactFieldApi = undefined;
        this.contactSortOrder = undefined;
    }
    handleColumnSorting(event) {
        this.sortByAccount = event.currentTarget.dataset.fieldName;
        this.sortDirectionAccount = event.currentTarget.dataset.order;
        this.dataType = event.currentTarget.dataset.type;
        this.sortingHandler();
        event.currentTarget.dataset.order = (this.sortDirectionAccount == 'asc' ? 'desc' : 'asc');
        let headerSortButton = this.template.querySelector(`lightning-button-icon[data-field-api-name="${this.sortByAccount}"]`);
        headerSortButton.iconName = headerSortButton.iconName == 'utility:arrowdown' ? 'utility:arrowup' : 'utility:arrowdown';
    }
    sortingHandler() {
        let sortedAccounts = [...this.initialAccounts];
        sortedAccounts.sort((a, b) => {
            let valueA = a[this.sortByAccount];
            let valueB = b[this.sortByAccount];
            if (this.dataType === 'String' || this.dataType === 'Picklist' || this.dataType === 'Phone') {
                valueA = valueA || '';
                valueB = valueB || '';
                return this.sortDirectionAccount === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            } else if (this.dataType === 'Currency' || this.dataType === 'Number') {
                valueA = typeof valueA === 'undefined' ? Number.MIN_SAFE_INTEGER : valueA;
                valueB = typeof valueB === 'undefined' ? Number.MIN_SAFE_INTEGER : valueB;
                return this.sortDirectionAccount === 'asc' ? valueA - valueB : valueB - valueA;
            }
            return 0;
        });
        this.initialAccounts = [...sortedAccounts];
    }
    async accountActions(event) {
        this.accountId = event.currentTarget.dataset.accountId;
        if (event.detail.value == 'edit') {
            this.showAccountEditForm = true;
        } else if (event.detail.value == 'delete') {
            try {
                await deleteRecord(this.accountId);
                await refreshApex(this.accountResult);
                this.sortingHandler();
                this.pageNumber = this.recordCount % this.recordPerPage == 0 && this.pageNumber == this.totalPages + 1 ? this.pageNumber - 1 : this.pageNumber;
                this.showInitialAccount();
                this.accountId = undefined;
                this.showToastMessage('Success', 'Account deleted Successfully', 'success');
            } catch (error) {
                this.showToastMessage('Error', error.body.message, 'error');
            }
        }
    }
    closeAccountHandler() {
        this.showAccountEditForm = false;
    }
    async handleAccountSuccess() {
        this.showAccountEditForm = false;
        await refreshApex(this.accountResult);
        this.sortingHandler();
        this.showInitialAccount();
        this.showToastMessage('Success', 'Account Updated Successfully', 'success');
    }
    newAccountCreate() {
        this.accountId = undefined;
        this.showAccountEditForm = true;
    }
    get cardTitle() {
        return `Accounts with Contacts (${this.recordCount})`;
    }
    contactSorting(event) {
        this.contactFieldApi = event.currentTarget.dataset.fieldApi;
        this.contactSortOrder = event.currentTarget.dataset.sortOrder;
        this.contactSortingHandler();
        event.target.iconName = event.target.iconName == 'utility:arrowup' ? 'utility:arrowdown' : 'utility:arrowup';
        event.currentTarget.dataset.sortOrder = this.contactSortOrder === 'asc' ? 'desc' : 'asc';
    }
    contactSortingHandler() {
        if (this.contactFieldApi && this.contactSortOrder) {
            let sortedContacts = [...this.contacts];
            sortedContacts.sort((a, b) => {
                let valueA = a[this.contactFieldApi] || '';
                let valueB = b[this.contactFieldApi] || '';
                return this.contactSortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            });
            this.contacts = [...sortedContacts];
        }
    }
    async contactAction(event) {
        let actionType = event.detail.value;
        let contactId = event.currentTarget.dataset.contactId
        if (actionType == 'edit') {
            this.mode = 'edit'
            this.isReadOnly = false;
            this.contactId = contactId;
            this.showViewEditModal = true;
        }
        else if (actionType == 'view') {
            this.mode = 'readonly'
            this.isReadOnly = true;
            this.contactId = contactId;
            this.showViewEditModal = true;
        } else if (actionType == 'delete') {
            try {
                await deleteRecord(contactId);
                await refreshApex(this.accountResult);
                let accountDetails = this.accountData.find(acc => acc.Id == this.accountId);
                this.contacts = accountDetails.contactSize > 0 ? accountDetails.Contacts : [];
                this.contactSortingHandler();
                this.showToastMessage('Success', 'Contact Deleted', 'success')
            } catch (error) {
                this.showToastMessage('Error', error.body.message, 'error')
            }
        }
    }
    changePerPageRecordHandler(event) {
        this.recordPerPage = parseInt(event.detail.value);
        this.pageNumber = 1;
        this.showInitialAccount();
    }

    get previousButtonsStyle() {
        return `slds-m-left_x-small custom-button ${this.enablePreviousPageButton ? 'custom-button-disabled' : ''}`;
    }
    get nextButtonsStyle() {
        return `slds-m-left_x-small custom-button ${this.enableNextPageButton ? 'custom-button-disabled' : ''}`;
    }
    previousPageHandler() {
        this.pageNumber = this.pageNumber > 1 ? this.pageNumber - 1 : this.pageNumber;
        this.accountId = undefined;
        this.showInitialAccount()
    }
    get totalPages() {
        return Math.ceil(this.recordCount / this.recordPerPage);
    }
    goToFirstPageHandler() {
        this.pageNumber = 1;
        this.accountId = undefined;
        this.showInitialAccount()
    }
    nextPageHandler() {
        this.pageNumber = this.pageNumber < this.totalPages ? this.pageNumber + 1 : this.pageNumber;
        this.accountId = undefined;
        this.showInitialAccount()
    }

    goToLastPageHandler() {
        this.pageNumber = this.totalPages;
        this.accountId = undefined;
        this.showInitialAccount();
    }
    get recordCount() {
        return this.accountData.length;
    }
    get recordFrom() {
        return (this.pageNumber - 1) * this.recordPerPage + 1;
    }
    get recordTo() {
        let total = this.pageNumber * this.recordPerPage;
        return total > this.recordCount ? this.recordCount : total;
    }
    get enableNextPageButton() {
        return this.pageNumber >= this.totalPages;
    }
    get enablePreviousPageButton() {
        return this.pageNumber <= 1;
    }
}