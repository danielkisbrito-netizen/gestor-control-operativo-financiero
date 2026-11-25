/* ============================================================
   Gestor de Control Operativo y Financiero — main.js
   JavaScript ES6+ puro. Sin librerías externas.
   Persistencia: LocalStorage (semilla inicial desde data.json).
   ============================================================ */

(() => {
    'use strict';

    /* ---------- Constantes ---------- */
    const STORAGE_KEY = 'gestor_finanzas_registros';
    const DATA_URL = 'data.json';

    const CATEGORIAS = {
        ingreso: 'Ingreso',
        egreso: 'Egreso',
        operativo: 'Operativo',
        administrativo: 'Administrativo',
    };

    /* ---------- Estado ---------- */
    let registros = [];

    /* ---------- Referencias DOM ---------- */
    const form = document.getElementById('registro-form');
    const inputDescripcion = document.getElementById('descripcion');
    const inputCategoria = document.getElementById('categoria');
    const inputTipo = document.getElementById('tipo');
    const inputMonto = document.getElementById('monto');
    const inputFecha = document.getElementById('fecha');
    const formFeedback = document.getElementById('form-feedback');

    const filtroCategoria = document.getElementById('filtro-categoria');
    const tablaBody = document.getElementById('tabla-body');

    const metricTotalRecords = document.getElementById('metric-total-records');
    const metricTotalAmount = document.getElementById('metric-total-amount');
    const metricBalance = document.getElementById('metric-balance');

    const btnExportar = document.getElementById('btn-exportar');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const inputImportar = document.getElementById('input-importar');

    /* ---------- Utilidades ---------- */
    const formatMoney = (value) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(value);

    const escapeHtml = (text) =>
        text.replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[ch]));

    const formatDate = (iso) => {
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    /* ---------- Persistencia ---------- */
    const guardarEnStorage = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
    };

    const cargarDesdeStorage = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    const cargarDesdeJson = async () => {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : (data.registros ?? []);
        } catch {
            // fetch falla bajo file:// — se usa lista vacía
            return [];
        }
    };

    const inicializarDatos = async () => {
        const guardados = cargarDesdeStorage();
        if (guardados && guardados.length > 0) {
            registros = guardados;
            return;
        }
        // Si no hay datos en LocalStorage, precargar desde data.json
        registros = await cargarDesdeJson();
        guardarEnStorage();
    };

    /* ---------- Validación ---------- */
    const validarRegistro = ({ descripcion, categoria, tipo, monto, fecha }) => {
        const errores = [];

        if (!descripcion || descripcion.trim().length < 3) {
            errores.push('La descripción debe tener al menos 3 caracteres.');
        }
        if (!Object.keys(CATEGORIAS).includes(categoria)) {
            errores.push('Seleccione una categoría válida.');
        }
        if (tipo !== 'ingreso' && tipo !== 'egreso') {
            errores.push('Seleccione un tipo de movimiento válido.');
        }
        const montoNum = Number(monto);
        if (!Number.isFinite(montoNum) || montoNum <= 0) {
            errores.push('El monto debe ser un número mayor que cero.');
        }
        if (!fecha) {
            errores.push('La fecha es obligatoria.');
        }
        return { valido: errores.length === 0, errores, montoNum };
    };

    const mostrarFeedback = (mensaje, tipo = 'error') => {
        formFeedback.textContent = mensaje;
        formFeedback.className = `feedback ${tipo}`;
    };

    /* ---------- Dashboard ---------- */
    const actualizarMetricas = () => {
        const total = registros.length;
        const totalMonto = registros.reduce((acc, r) => acc + Number(r.monto), 0);
        const ingresos = registros
            .filter((r) => r.tipo === 'ingreso')
            .reduce((acc, r) => acc + Number(r.monto), 0);
        const egresos = registros
            .filter((r) => r.tipo === 'egreso')
            .reduce((acc, r) => acc + Number(r.monto), 0);
        const balance = ingresos - egresos;

        metricTotalRecords.textContent = total;
        metricTotalAmount.textContent = formatMoney(totalMonto);
        metricBalance.textContent = formatMoney(balance);
        metricBalance.classList.toggle('positive', balance >= 0);
        metricBalance.classList.toggle('negative', balance < 0);
    };

    /* ---------- Tabla ---------- */
    const registrosFiltrados = () => {
        const cat = filtroCategoria.value;
        return cat ? registros.filter((r) => r.categoria === cat) : registros;
    };

    const renderizarTabla = () => {
        const lista = registrosFiltrados();

        if (lista.length === 0) {
            tablaBody.innerHTML = `
                <tr><td colspan="6" class="empty-state">No hay registros ${filtroCategoria.value ? 'en esta categoría' : 'aún'}.</td></tr>`;
            return;
        }

        tablaBody.innerHTML = lista
            .map((r) => {
                const esIngreso = r.tipo === 'ingreso';
                const claseMonto = esIngreso ? 'income' : 'expense';
                const signo = esIngreso ? '+' : '−';
                return `
                    <tr data-id="${escapeHtml(r.id)}">
                        <td>${escapeHtml(r.descripcion)}</td>
                        <td><span class="badge ${escapeHtml(r.categoria)}">${CATEGORIAS[r.categoria] ?? escapeHtml(r.categoria)}</span></td>
                        <td><span class="badge ${escapeHtml(r.tipo)}">${esIngreso ? 'Ingreso' : 'Egreso'}</span></td>
                        <td class="amount ${claseMonto}">${signo}${formatMoney(Number(r.monto))}</td>
                        <td>${formatDate(r.fecha)}</td>
                        <td><button type="button" class="btn-delete" data-action="delete" data-id="${escapeHtml(r.id)}" aria-label="Eliminar registro">Eliminar</button></td>
                    </tr>`;
            })
            .join('');
    };

    const actualizarVista = () => {
        actualizarMetricas();
        renderizarTabla();
    };

    /* ---------- Eventos ---------- */
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Validación nativa HTML5 primero
        if (!form.reportValidity()) return;

        const datos = {
            descripcion: inputDescripcion.value.trim(),
            categoria: inputCategoria.value,
            tipo: inputTipo.value,
            monto: inputMonto.value,
            fecha: inputFecha.value,
        };

        const { valido, errores, montoNum } = validarRegistro(datos);
        if (!valido) {
            mostrarFeedback(errores.join(' '));
            return;
        }

        registros.push({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            ...datos,
            monto: montoNum.toFixed(2),
            fechaRegistro: new Date().toISOString(),
        });

        guardarEnStorage();
        actualizarVista();
        form.reset();
        mostrarFeedback('Registro guardado correctamente.', 'success');
    });

    filtroCategoria.addEventListener('change', renderizarTabla);

    tablaBody.addEventListener('click', (event) => {
        const boton = event.target.closest('[data-action="delete"]');
        if (!boton) return;

        const { id } = boton.dataset;
        const registro = registros.find((r) => r.id === id);
        const confirmado = window.confirm(
            `¿Eliminar el registro "${registro ? registro.descripcion : id}"?`
        );
        if (!confirmado) return;

        registros = registros.filter((r) => r.id !== id);
        guardarEnStorage();
        actualizarVista();
    });

    btnExportar.addEventListener('click', () => {
        if (registros.length === 0) {
            window.alert('No hay registros para exportar.');
            return;
        }

        const payload = {
            sistema: 'Gestor de Control Operativo y Financiero',
            exportadoEl: new Date().toISOString(),
            totalRegistros: registros.length,
            registros,
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `respaldo-registros-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });

    btnLimpiar.addEventListener('click', () => {
        if (registros.length === 0) {
            window.alert('No hay registros para limpiar.');
            return;
        }
        if (!window.confirm('¿Está seguro de eliminar TODOS los registros? Esta acción no se puede deshacer.')) return;

        registros = [];
        guardarEnStorage();
        actualizarVista();
        window.alert('Todos los registros fueron eliminados.');
    });

    inputImportar.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                const lista = Array.isArray(data) ? data : (data.registros ?? []);
                if (!Array.isArray(lista)) throw new Error('Formato inválido');

                registros = lista;
                guardarEnStorage();
                actualizarVista();
                window.alert(`Se importaron ${lista.length} registros correctamente.`);
            } catch {
                window.alert('El archivo JSON no tiene un formato válido.');
            } finally {
                inputImportar.value = '';
            }
        };
        reader.readAsText(file);
    });

    /* ---------- Inicio ---------- */
    inicializarDatos().then(() => {
        inputFecha.valueAsDate = new Date();
        actualizarVista();
    });
})();
