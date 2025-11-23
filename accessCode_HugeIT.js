import { LightningElement, track } from 'lwc';

export default class AccessCode_HugeIT extends LightningElement {
    // Reference image path (for pipeline/tooling). Not used in template to avoid runtime errors.
    referenceImagePath = '/mnt/data/Screenshot 2025-11-20 at 4.55.50 PM.png';

    // Step state
    @track currentStep = 1;
    get isStep1() { return this.currentStep === 1; }
    get isStep2() { return this.currentStep === 2; }
    get isStep3() { return this.currentStep === 3; }
    get isStep4() { return this.currentStep === 4; }
    get isFirstStep() { return this.currentStep === 1; }
    get nextLabel() { return this.currentStep === 3 ? 'Submit' : 'Next'; }

    // Top badge classes (locked)
    get stepClass1(){ return this.currentStep === 1 ? 'step active locked' : (this.currentStep > 1 ? 'step completed locked' : 'step locked');}
    get stepClass2(){ return this.currentStep === 2 ? 'step active locked' : (this.currentStep > 2 ? 'step completed locked' : 'step locked');}
    get stepClass3(){ return this.currentStep === 3 ? 'step active locked' : (this.currentStep > 3 ? 'step completed locked' : 'step locked');}
    get stepClass4(){ return this.currentStep === 4 ? 'step active locked' : (this.currentStep > 4 ? 'step completed locked' : 'step locked');}

    // form model
    @track form = {
        numberOfCodes: '',
        status: '',
        startDate: '',
        endDate: '',
        maxUsesAllowed: '',
        comment: '',
        durationType: '',
        durationValue: ''
    };

    // UI errors
    @track uiErrors = { products: '' };

    // options
    statusOptions = [
        { label: 'Active', value: 'Active' },
        { label: 'Inactive', value: 'Inactive' }
    ];
    durationTypeOptions = [
        { label: 'Number of Days', value: 'Days' },
        { label: 'Specific Date', value: 'Date' }
    ];
    productOptions = [
        { label: 'Product A', value: 'pA' },
        { label: 'Product B', value: 'pB' },
        { label: 'Product C', value: 'pC' }
    ];

    // products
    @track selectedProduct = '';
    @track override = { type: '', value: '' };
    @track linkedProducts = [];

    // job progress simulation
    @track jobStatus = 'Queued';
    @track codesGenerated = 0;
    @track elapsedTime = 0;
    jobInterval = null;

    // ---------------------------
    // Input change handlers
    // ---------------------------
    handleInputChange(event) {
        const field = event.target.dataset.field;
        if (field) {
            this.form[field] = event.target.value;
        }
    }

    handleProductSelect(event) {
        this.selectedProduct = event.target.value;
        this.uiErrors.products = '';
    }

    handleOverrideChange(event) {
        const f = event.target.dataset.override;
        if (f) this.override[f] = event.target.value;
    }

    // ---------------------------
    // Validation helpers (use built-in reportValidity / setCustomValidity)
    // ---------------------------
    validateStep1Full() {
        const inputs = [
            ...this.template.querySelectorAll('lightning-input[data-field]'),
            ...this.template.querySelectorAll('lightning-combobox[data-field]'),
            ...this.template.querySelectorAll('lightning-textarea[data-field]')
        ];

        let valid = true;
        inputs.forEach(cmp => {
            try { cmp.setCustomValidity(''); } catch (e) { /* ignore */ }
            const ok = cmp.reportValidity();
            if (!ok) valid = false;
        });

        // Numeric validations (positive integers)
        const numCmp = this.template.querySelector('lightning-input[data-field="numberOfCodes"]');
        if (numCmp) {
            const v = (this.form.numberOfCodes || '').toString().trim();
            if (!/^\d+$/.test(v) || parseInt(v,10) <= 0) {
                numCmp.setCustomValidity('Enter a positive integer.');
                numCmp.reportValidity();
                valid = false;
            }
        }

        const maxCmp = this.template.querySelector('lightning-input[data-field="maxUsesAllowed"]');
        if (maxCmp) {
            const v = (this.form.maxUsesAllowed || '').toString().trim();
            if (!/^\d+$/.test(v) || parseInt(v,10) <= 0) {
                maxCmp.setCustomValidity('Enter a positive integer.');
                maxCmp.reportValidity();
                valid = false;
            }
        }

        // Duration value conditional validation:
        if (this.form.durationType === 'Days') {
            // durationValue must be a positive integer
            if (!/^\d+$/.test((this.form.durationValue || '').toString().trim())) {
                const durCmp = this.template.querySelector('lightning-input[data-field="durationValue"]');
                if (durCmp) {
                    durCmp.setCustomValidity('When Duration Type is "Number of Days", Duration Value must be a positive integer.');
                    durCmp.reportValidity();
                    valid = false;
                }
            }
        } else if (this.form.durationType === 'Date') {
            // durationValue must be a valid date (YYYY-MM-DD)
            const v = (this.form.durationValue || '').toString().trim();
            if (!v || isNaN(new Date(v))) {
                const durCmp = this.template.querySelector('lightning-input[data-field="durationValue"]');
                if (durCmp) {
                    durCmp.setCustomValidity('When Duration Type is "Specific Date", Duration Value must be a valid date (YYYY-MM-DD).');
                    durCmp.reportValidity();
                    valid = false;
                }
            }
        }

        // Date coherence
        if (this.form.startDate && this.form.endDate) {
            const start = new Date(this.form.startDate);
            const end = new Date(this.form.endDate);
            if (end < start) {
                const endCmp = this.template.querySelector('lightning-input[data-field="endDate"]');
                if (endCmp) {
                    endCmp.setCustomValidity('End Date must be after Start Date.');
                    endCmp.reportValidity();
                    valid = false;
                }
            }
        }

        return valid;
    }

    // Products step is optional now. Always valid. Skip button will move forward.
    validateStep2Full() {
        this.uiErrors.products = '';
        return true;
    }

    // quick checks for disabling Next without showing errors
    quickStep1Valid() {
        try {
            const n = (this.form.numberOfCodes || '').toString().trim();
            if (!n || !/^\d+$/.test(n) || parseInt(n,10) <= 0) return false;
            if (!(this.form.status || '').toString().trim()) return false;
            if (!(this.form.startDate || '').toString().trim()) return false;
            if (!(this.form.endDate || '').toString().trim()) return false;
            if (!(this.form.maxUsesAllowed || '').toString().trim() || !/^\d+$/.test(this.form.maxUsesAllowed)) return false;
            if (!(this.form.durationType || '').toString().trim()) return false;
            if (!(this.form.durationValue || '').toString().trim()) return false;
            // duration value conditional quick check
            if (this.form.durationType === 'Days' && (!/^\d+$/.test((this.form.durationValue || '').toString().trim()))) return false;
            if (this.form.durationType === 'Date' && isNaN(new Date(this.form.durationValue))) return false;
            if (new Date(this.form.endDate) < new Date(this.form.startDate)) return false;
            return true;
        } catch (e) { return false; }
    }

    // Products optional -> always valid quickly
    quickStep2Valid() {
        return true;
    }

    get isNextDisabled() {
        if (this.currentStep === 1) return !this.quickStep1Valid();
        if (this.currentStep === 2) return !this.quickStep2Valid();
        return false;
    }

    // ---------------------------
    // Navigation
    // ---------------------------
    goNext() {
        if (this.currentStep === 1) {
            if (!this.validateStep1Full()) return;
            this.currentStep = 2;
            return;
        }
        if (this.currentStep === 2) {
            // products optional
            if (!this.validateStep2Full()) return;
            this.currentStep = 3;
            return;
        }
        if (this.currentStep === 3) {
            // final submit: revalidate parameters fully
            if (!this.validateStep1Full()) return;
            // step2 optional so no re-check
            this.startJob();
            this.currentStep = 4;
        }
    }

    goBack() {
        if (this.currentStep > 1) this.currentStep--;
    }

    // Skip Products action
    skipProducts() {
        // User chose to skip products — clear any UI errors and move to review
        this.uiErrors.products = '';
        this.currentStep = 3;
    }

    // ---------------------------
    // Products actions
    // ---------------------------
    addProduct() {
        this.uiErrors.products = '';
        if (!this.selectedProduct) {
            this.uiErrors.products = 'Select a product before adding.';
            return;
        }
        const exists = this.linkedProducts.find(p => p.id === this.selectedProduct);
        if (exists) {
            this.uiErrors.products = 'Product already added.';
            return;
        }
        const productName = (this.productOptions.find(p => p.value === this.selectedProduct) || {}).label || this.selectedProduct;
        const durationText = `${this.override.type || this.form.durationType || '-'} - ${this.override.value || this.form.durationValue || '-'}`;
        this.linkedProducts = [...this.linkedProducts, { id: this.selectedProduct, name: productName, durationText }];
        this.selectedProduct = '';
        this.override = { type: '', value: '' };
    }

    removeProduct() {
        if (this.linkedProducts.length === 0) {
            this.uiErrors.products = 'No product to remove.';
            return;
        }
        this.linkedProducts = this.linkedProducts.slice(0, -1);
    }

    resetOverrides() {
        this.override.type = this.form.durationType || '';
        this.override.value = this.form.durationValue || '';
    }

    // ---------------------------
    // Review formatting getters
    // ---------------------------
    formatDate(d) {
        if (!d) return '-';
        try {
            const dt = new Date(d);
            if (isNaN(dt)) return d;
            return dt.toLocaleDateString();
        } catch (e) {
            return d;
        }
    }

    get formattedStartDate() {
        return this.formatDate(this.form.startDate);
    }

    get formattedEndDate() {
        return this.formatDate(this.form.endDate);
    }

    get commentValue() {
        return this.form.comment ? this.form.comment : '-';
    }

    // ---------------------------
    // Job simulation
    // ---------------------------
    startJob() {
        this.jobStatus = 'Running';
        this.codesGenerated = 0;
        this.elapsedTime = 0;
        if (this.jobInterval) { clearInterval(this.jobInterval); this.jobInterval = null; }
        const total = parseInt(this.form.numberOfCodes || '0', 10) || 0;
        this.jobInterval = setInterval(() => {
            this.elapsedTime++;
            this.codesGenerated = Math.min(total, this.codesGenerated + Math.ceil(Math.max(1, total / 10)));
            if (this.codesGenerated >= total) {
                clearInterval(this.jobInterval);
                this.jobInterval = null;
                this.jobStatus = 'Completed';
            }
        }, 1000);
    }

    retryJob() {
        this.startJob();
    }

    cancelJob() {
        if (this.jobInterval) {
            clearInterval(this.jobInterval);
            this.jobInterval = null;
        }
        this.jobStatus = 'Cancelled';
    }
}
