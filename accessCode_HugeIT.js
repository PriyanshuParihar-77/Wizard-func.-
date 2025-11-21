import { LightningElement, track } from 'lwc';

export default class AccessCode_HugeIT extends LightningElement {
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
        // combobox and inputs set data-field / data-override as needed
        if (field) {
            this.form[field] = event.target.value;
            // quick validation to allow enabling Next
            // don't call reportValidity here to avoid extra UI noise
            // we'll run reportValidity when Next is pressed
        }
    }

    handleProductSelect(event) {
        this.selectedProduct = event.target.value;
        this.uiErrors.products = '';
    }

    handleOverrideChange(event) {
        const f = event.target.dataset.override;
        if (f) {
            this.override[f] = event.target.value;
        }
    }

    // ---------------------------
    // Validation helpers (use built-in reportValidity / setCustomValidity)
    // ---------------------------
    validateStep1Full() {
        // Select all form inputs inside current template
        const inputs = [
            ...this.template.querySelectorAll('lightning-input[data-field]'),
            ...this.template.querySelectorAll('lightning-combobox[data-field]'),
            ...this.template.querySelectorAll('lightning-textarea[data-field]')
        ];

        // Clear custom validity for date logic first
        const start = this.form.startDate;
        const end = this.form.endDate;
        // Basic required validation will be handled by components (required + message-when-value-missing)
        // but we need to set custom messages for date coherence and numeric positive checks.
        // We'll set custom validity on the individual components when needed.

        // Validate each component individually
        let valid = true;
        inputs.forEach((cmp) => {
            // clear previous custom validity
            try { cmp.setCustomValidity(''); } catch (e) { /* ignore */ }

            // use built-in reportValidity to run required checks
            const ok = cmp.reportValidity();
            if (!ok) valid = false;
        });

        // Additional numeric validations and date coherence
        // Number of codes must be positive integer
        const numCmp = this.template.querySelector('lightning-input[data-field="numberOfCodes"]');
        if (numCmp) {
            const v = (this.form.numberOfCodes || '').toString().trim();
            if (!/^\d+$/.test(v) || parseInt(v,10) <= 0) {
                numCmp.setCustomValidity('Enter a positive integer.');
                numCmp.reportValidity();
                valid = false;
            }
        }

        const maxUsesCmp = this.template.querySelector('lightning-input[data-field="maxUsesAllowed"]');
        if (maxUsesCmp) {
            const v = (this.form.maxUsesAllowed || '').toString().trim();
            if (!/^\d+$/.test(v) || parseInt(v,10) <= 0) {
                maxUsesCmp.setCustomValidity('Enter a positive integer.');
                maxUsesCmp.reportValidity();
                valid = false;
            }
        }

        // Date coherence
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            if (endDate < startDate) {
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

    validateStep2Full() {
        // products: require at least one linked product
        this.uiErrors.products = '';
        if (this.linkedProducts.length === 0) {
            this.uiErrors.products = 'Please add at least one product.';
            return false;
        }
        return true;
    }

    // ---------------------------
    // Quick validation (for disabling Next)
    // quickStep1Valid does lightweight checks, without showing validation UI
    // ---------------------------
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
            if (new Date(this.form.endDate) < new Date(this.form.startDate)) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    quickStep2Valid() {
        return this.linkedProducts.length > 0;
    }

    get isNextDisabled() {
        if (this.currentStep === 1) return !this.quickStep1Valid();
        if (this.currentStep === 2) return !this.quickStep2Valid();
        // step 3 is review; Next becomes Submit — keep enabled
        return false;
    }

    // ---------------------------
    // Navigation
    // ---------------------------
    goNext() {
        // full validations per step (these use reportValidity and show inline errors)
        if (this.currentStep === 1) {
            if (!this.validateStep1Full()) return;
            this.currentStep = 2;
            return;
        }

        if (this.currentStep === 2) {
            if (!this.validateStep2Full()) return;
            this.currentStep = 3;
            return;
        }

        if (this.currentStep === 3) {
            // final submit
            if (!this.validateStep1Full()) return;
            if (!this.validateStep2Full()) return;
            this.startJob();
            this.currentStep = 4;
            return;
        }
    }

    goBack() {
        if (this.currentStep > 1) this.currentStep--;
    }

    // ---------------------------
    // Products management
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
        // reset selection
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
    // Review getters
    // ---------------------------
    get reviewParameters() {
        const copy = { ...this.form };
        return JSON.stringify(copy, null, 2);
    }
    get reviewProducts() {
        return JSON.stringify(this.linkedProducts, null, 2);
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
