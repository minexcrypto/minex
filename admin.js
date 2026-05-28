
/* ══════════════════════════════════════════════════════════════
   EDIT OLD USER MODULE
══════════════════════════════════════════════════════════════ */

const EditOldUserModule = {

    _rows: [],
    _page: 1,
    _pageSize: 15,
    _selectedUser: null,

    goPage(n) {
        this._page = n;
        this._renderPage();
    },

    async loadUsers() {

        const container = document.getElementById('editOldUserTableWrap');

        if (!container || !sb) return;

        setHTML(container, AdminUI.loading('Loading users...'));

        try {

            const search =
                ($('#editOldUserSearchInput')?.value || '')
                .trim()
                .toLowerCase();

            const planFilter =
                ($('#editOldUserPlanFilter')?.value || 'all')
                .toLowerCase();

            let query = sb
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (planFilter !== 'all') {
                query = query.eq('plan', planFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            let rows = data || [];

            if (search) {

                rows = rows.filter(u => {

                    const text =
                        `${u.email || ''} ${u.id || ''} ${u.name || ''}`
                        .toLowerCase();

                    return text.includes(search);
                });
            }

            this._rows = rows;

            this._page = 1;

            this._renderPage();

        } catch (err) {

            setHTML(
                container,
                AdminUI.error('Failed to load users: ' + err.message)
            );
        }
    },

    _renderPage() {

        const container = document.getElementById('editOldUserTableWrap');

        paginate(
            this._rows,
            this._pageSize,
            this._page,
            'editOldUserPagination',
            (pageRows) => this._render(container, pageRows),
            'EditOldUserModule'
        );
    },

    _render(container, rows) {

        if (!rows.length) {

            setHTML(container, AdminUI.empty('No users found.'));
            return;
        }

        const html = rows.map(u => {

            return `
            <tr>

                <td style="${TD}">
                    ${u.name || '—'}
                </td>

                <td style="${TD}">
                    ${u.email || '—'}
                </td>

                <td style="${TD}">
                    ${u.plan || 'starter'}
                </td>

                <td style="${TD}">
                    ${AdminUI.badge(u.status || 'active')}
                </td>

                <td style="${TD}">
                    ${Number(u.usdt_balance || 0).toFixed(2)} USDT
                </td>

                <td style="${TD}">
                    ${Number(u.daily_profit_balance || 0).toFixed(2)}
                </td>

                <td style="${TD}">
                    <button
                        class="admin-btn admin-btn-primary"
                        onclick="EditOldUserModule.selectUser('${u.id}')">
                        ✏️ Edit
                    </button>
                </td>

            </tr>
            `;

        }).join('');

        setHTML(container, `
        <table style="width:100%;border-collapse:collapse">

            <thead>
                <tr>
                    <th style="${TH}">Name</th>
                    <th style="${TH}">Email</th>
                    <th style="${TH}">Plan</th>
                    <th style="${TH}">Status</th>
                    <th style="${TH}">Wallet</th>
                    <th style="${TH}">Daily Profit</th>
                    <th style="${TH}">Action</th>
                </tr>
            </thead>

            <tbody>
                ${html}
            </tbody>

        </table>
        `);
    },

    async selectUser(userId) {

        try {

            const { data, error } = await sb
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            this._selectedUser = data;

            show('#editOldUserFormWrap');

            $('#eouName').value = data.name || '';
            $('#eouEmail').value = data.email || '';
            $('#eouPhone').value = data.phone || '';
            $('#eouCountry').value = data.country || '';

            $('#eouPlan').value =
                (data.plan || 'starter').toLowerCase();

            $('#eouStatus').value =
                (data.status || 'active').toLowerCase();

            $('#eouWalletBalance').value =
                Number(data.usdt_balance || 0);

            $('#eouDailyProfit').value =
                Number(data.daily_profit_balance || 0);

            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });

        } catch (err) {

            AdminUI.toast(err.message, 'error');
        }
    },

    async saveUser() {

        if (!this._selectedUser) {
            AdminUI.toast('No user selected.', 'error');
            return;
        }

        try {

            const payload = {

                name:
                    $('#eouName')?.value?.trim() || '',

                email:
                    $('#eouEmail')?.value?.trim() || '',

                phone:
                    $('#eouPhone')?.value?.trim() || '',

                country:
                    $('#eouCountry')?.value?.trim() || '',

                plan:
                    $('#eouPlan')?.value || 'starter',

                status:
                    $('#eouStatus')?.value || 'active',

                usdt_balance:
                    parseFloat(
                        $('#eouWalletBalance')?.value || 0
                    ),

                daily_profit_balance:
                    parseFloat(
                        $('#eouDailyProfit')?.value || 0
                    ),
            };

            const { error } = await sb
                .from('profiles')
                .update(payload)
                .eq('id', this._selectedUser.id);

            if (error) throw error;

            await logAdminAction(
                'edit_old_user',
                'profiles',
                this._selectedUser.id,
                this._selectedUser,
                payload
            );

            AdminUI.toast(
                'User updated successfully.',
                'success'
            );

            this.clearForm();

            await this.loadUsers();

        } catch (err) {

            AdminUI.toast(
                'Update failed: ' + err.message,
                'error'
            );
        }
    },

    clearForm() {

        this._selectedUser = null;

        hide('#editOldUserFormWrap');

        [
            '#eouName',
            '#eouEmail',
            '#eouPhone',
            '#eouCountry',
            '#eouWalletBalance',
            '#eouDailyProfit'
        ].forEach(id => {

            const el = $(id);

            if (el) el.value = '';
        });
    }
};
window.EditOldUserModule = EditOldUserModule;
