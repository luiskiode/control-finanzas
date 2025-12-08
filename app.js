document.addEventListener("DOMContentLoaded", async () => {
  // ---- Refs UI ----
  const form = document.getElementById("movForm");
  const tabla = document.querySelector("#tablaMov tbody");
  const categoriaSelect = document.getElementById("categoria");

  const fDesde = document.getElementById("fDesde");
  const fHasta = document.getElementById("fHasta");
  const fTipo  = document.getElementById("fTipo");
  const fMoneda = document.getElementById("fMoneda");
  const fBanco  = document.getElementById("fBanco");
  const fOrigen = document.getElementById("fOrigen");
  const fSoloHormiga = document.getElementById("fSoloHormiga");

  const btnAplicar  = document.getElementById("btnAplicarFiltros");
  const btnLimpiar  = document.getElementById("btnLimpiarFiltros");
  const btnExportar = document.getElementById("btnExportar");

  const tcActualInput   = document.getElementById("tcActual");
  const tcObjetivoInput = document.getElementById("tcObjetivo");
  const alertaTC        = document.getElementById("alertaTC");
  const alertaHormiga   = document.getElementById("alertaHormiga");
  const listaRecs       = document.getElementById("listaRecomendaciones");

  const tipoSelect    = document.getElementById("tipo");
  const monedaSelect  = document.getElementById("moneda");
  const bancoSelect   = document.getElementById("banco");
  const origenSelect  = document.getElementById("origen");
  const esHormigaChk  = document.getElementById("esHormiga");

  // ---- Helpers ----
  function normalizarFecha(d) {
    if (!d) return null;
    const date = (d instanceof Date) ? d : new Date(d + "T00:00:00");
    return isNaN(date) ? null : date;
  }

  function getTCActual() {
    const v = parseFloat(tcActualInput?.value || "");
    return isNaN(v) ? null : v;
  }

  function getTCObjetivo() {
    const v = parseFloat(tcObjetivoInput?.value || "");
    return isNaN(v) ? null : v;
  }

  function aplicarFiltros(data) {
    const dDesde = normalizarFecha(fDesde?.value);
    const dHasta = normalizarFecha(fHasta?.value);
    const tipo   = fTipo?.value || "";
    const moneda = fMoneda?.value || "";
    const banco  = fBanco?.value || "";
    const origen = fOrigen?.value || "";
    const soloHormiga = !!fSoloHormiga?.checked;

    return (data || []).filter(m => {
      const fecha = new Date(m.fecha);

      if (dDesde && fecha < dDesde) return false;
      if (dHasta) {
        const dH = new Date(dHasta);
        dH.setHours(23, 59, 59, 999);
        if (fecha > dH) return false;
      }

      if (tipo && m.tipo !== tipo) return false;
      if (moneda && (m.moneda || "PEN") !== moneda) return false;
      if (banco && (m.banco || "") !== banco) return false;
      if (origen && (m.origen || "Manual") !== origen) return false;
      if (soloHormiga && !m.es_hormiga) return false;

      return true;
    });
  }

  function exportarCSV(rows) {
    const encabezado = [
      "fecha",
      "tipo",
      "moneda",
      "monto",
      "banco",
      "origen",
      "es_hormiga",
      "categoria",
      "descripcion"
    ];

    const lineas = [encabezado.join(",")];

    for (const r of rows) {
      const fecha = new Date(r.fecha).toISOString().slice(0, 10);
      const tipo  = r.tipo || "";
      const moneda = r.moneda || "PEN";
      const monto = Number(r.monto ?? 0).toFixed(2);
      const banco = (r.banco || "").replace(/,/g, " ");
      const origen = (r.origen || "").replace(/,/g, " ");
      const esHormiga = r.es_hormiga ? "1" : "0";
      const cat   = (r.categorias?.nombre || "").replace(/,/g, " ");
      const desc  = (r.descripcion || "").replace(/,/g, " ");

      lineas.push([
        fecha,
        tipo,
        moneda,
        monto,
        banco,
        origen,
        esHormiga,
        cat,
        desc
      ].join(","));
    }

    const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function actualizarResumen(movs) {
    const sum = {
      PEN: { ingresos: 0, gastos: 0 },
      USD: { ingresos: 0, gastos: 0 }
    };

    (movs || []).forEach(m => {
      const moneda = m.moneda || "PEN";
      const bucket = sum[moneda] || (sum[moneda] = { ingresos: 0, gastos: 0 });
      const monto = Number(m.monto || 0);
      if (m.tipo === "Ingreso") bucket.ingresos += monto;
      if (m.tipo === "Gasto")   bucket.gastos   += monto;
    });

    const fmtPen = v => "S/ " + Number(v).toFixed(2);
    const fmtUsd = v => "$ "  + Number(v).toFixed(2);

    const ingresosPEN = sum.PEN?.ingresos || 0;
    const gastosPEN   = sum.PEN?.gastos   || 0;
    const balancePEN  = ingresosPEN - gastosPEN;

    const ingresosUSD = sum.USD?.ingresos || 0;
    const gastosUSD   = sum.USD?.gastos   || 0;
    const balanceUSD  = ingresosUSD - gastosUSD;

    document.getElementById("totalIngresosPEN").textContent = fmtPen(ingresosPEN);
    document.getElementById("totalGastosPEN").textContent   = fmtPen(gastosPEN);
    document.getElementById("balancePEN").textContent       = fmtPen(balancePEN);

    document.getElementById("totalIngresosUSD").textContent = fmtUsd(ingresosUSD);
    document.getElementById("totalGastosUSD").textContent   = fmtUsd(gastosUSD);
    document.getElementById("balanceUSD").textContent       = fmtUsd(balanceUSD);

    actualizarAlertaTC(balanceUSD);
    actualizarAlertaHormiga(movs);
    actualizarRecomendaciones(movs, balancePEN, balanceUSD);
  }

  function actualizarAlertaTC(balanceUSD) {
    if (!alertaTC) return;
    const tcActual   = getTCActual();
    const tcObjetivo = getTCObjetivo();

    alertaTC.className = "alerta info";

    if (tcActual == null || tcObjetivo == null || tcActual <= 0 || tcObjetivo <= 0) {
      alertaTC.textContent = "Ingresa el tipo de cambio actual y el objetivo para recibir sugerencias.";
      return;
    }

    if (!balanceUSD || balanceUSD <= 0) {
      alertaTC.textContent = "Actualmente no tienes balance positivo en USD. Cuando acumules dólares te avisaré si es un buen momento para vender.";
      return;
    }

    const equivSoles = balanceUSD * tcActual;

    if (tcActual >= tcObjetivo) {
      alertaTC.className = "alerta ok";
      alertaTC.textContent = `🌟 Hoy el tipo de cambio (≈ ${tcActual.toFixed(3)}) está en o por encima de tu objetivo (${tcObjetivo.toFixed(3)}). Podrías considerar vender ${balanceUSD.toFixed(2)} USD ≈ S/ ${equivSoles.toFixed(2)}.`;
    } else {
      alertaTC.className = "alerta neutra";
      alertaTC.textContent = `Aún no se alcanza tu tipo de cambio objetivo (${tcObjetivo.toFixed(3)}). Hoy está en ≈ ${tcActual.toFixed(3)}.`;
    }
  }

  function actualizarAlertaHormiga(movs) {
    if (!alertaHormiga) return;

    const tcActual = getTCActual() || 0;
    const hoy = new Date();
    const keyHoy = hoy.toISOString().slice(0, 10);

    let totalHormigaHoySoles = 0;

    (movs || []).forEach(m => {
      if (!m.es_hormiga) return;
      const fecha = new Date(m.fecha);
      const keyFecha = fecha.toISOString().slice(0, 10);
      if (keyFecha !== keyHoy) return;

      let monto = Number(m.monto || 0);
      if ((m.moneda || "PEN") === "USD" && tcActual > 0) {
        monto = monto * tcActual;
      }
      totalHormigaHoySoles += monto;
    });

    const LIMITE = 5; // S/ 5 diarios

    if (totalHormigaHoySoles === 0) {
      alertaHormiga.className = "alerta neutra";
      alertaHormiga.textContent = "Aún no tienes gastos hormiga registrados hoy. Mantén esa disciplina 👏";
      return;
    }

    if (totalHormigaHoySoles <= LIMITE) {
      alertaHormiga.className = "alerta ok";
      alertaHormiga.textContent = `Vas ${totalHormigaHoySoles.toFixed(2)} de S/ 5.00 en gastos hormiga hoy. Vas bien, pero ojo con las tentaciones.`;
    } else {
      alertaHormiga.className = "alerta danger";
      alertaHormiga.textContent = `⚠️ Hoy superaste el límite de S/ 5.00 en gastos hormiga (llevas S/ ${totalHormigaHoySoles.toFixed(2)}). Revisa qué pequeños gastos puedes recortar.`;
    }
  }

  function actualizarRecomendaciones(movs, balancePEN, balanceUSD) {
    if (!listaRecs) return;
    listaRecs.innerHTML = "";

    const recs = [];

    // 1) Si balance en PEN es muy bajo y en USD alto -> sugerir cambio parcial
    if (balancePEN < 0 && balanceUSD > 0) {
      recs.push("Tienes un balance negativo en soles pero positivo en dólares. Evalúa cambiar una parte de tus USD a PEN para cubrir gastos inmediatos.");
    }

    // 2) Si gastos hormiga son altos en últimos 7 días
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 7);

    let totalHormiga7d = 0;
    (movs || []).forEach(m => {
      if (!m.es_hormiga) return;
      const fecha = new Date(m.fecha);
      if (fecha < hace7 || fecha > hoy) return;
      let monto = Number(m.monto || 0);
      // Aquí podrías convertir todo a PEN con tcActual si quisieras
      totalHormiga7d += monto;
    });

    if (totalHormiga7d > 20) {
      recs.push("En los últimos 7 días tus gastos hormiga superan los 20 unidades de moneda. Considera limitar estos gastos para liberar más dinero para inversión.");
    }

    // 3) Si gran parte de gastos vienen de Yape
    const totalGastos = (movs || []).filter(m => m.tipo === "Gasto");
    const gastosYape = totalGastos.filter(m => (m.origen || "Manual") === "Yape");

    if (totalGastos.length > 0 && gastosYape.length / totalGastos.length > 0.5) {
      recs.push("Más del 50% de tus gastos salen por Yape. Tal vez te ayude definir un tope semanal para pagos por Yape.");
    }

    // 4) Si no hay recomendaciones, mensaje base
    if (recs.length === 0) {
      recs.push("Por ahora tu flujo se ve estable. Sigue registrando cada movimiento para obtener recomendaciones más precisas.");
    }

    recs.forEach(r => {
      const li = document.createElement("li");
      li.textContent = r;
      listaRecs.appendChild(li);
    });
  }

  // ---- Categorías (con fallback) ----
  try {
    const { data: categoriasData, error: catErr } = await supabase.from("fin_categorias").select("*");
    if (catErr) console.error(catErr);
    const categoriasList = (categoriasData && categoriasData.length)
      ? categoriasData
      : [{ id: null, nombre: "Sin categoría" }];

    categoriaSelect.innerHTML = categoriasList
      .map(c => `<option value="${c.id ?? ""}">${c.nombre}</option>`)
      .join("");
  } catch (e) {
    console.error("Error cargando categorías:", e);
    categoriaSelect.innerHTML = `<option value="">Sin categoría</option>`;
  }

  // ---- Movimientos + render ----
  let cacheMovimientos = [];

  async function cargarMovimientos() {
    const { data, error } = await supabase
      .from("movimientos")
      .select("*, categorias(nombre)")
      .order("fecha", { ascending: false });

    if (error) console.error(error);

    // Asegurar valores por defecto para nuevas columnas
    cacheMovimientos = (data || []).map(m => ({
      moneda: "PEN",
      origen: "Manual",
      es_hormiga: false,
      ...m
    }));

    renderTablaYResumen();
  }

  function renderTablaYResumen() {
    const filtrados = aplicarFiltros(cacheMovimientos);

    tabla.innerHTML = filtrados.map(m => {
      const fechaStr = new Date(m.fecha).toLocaleString();
      const tipo = m.tipo;
      const moneda = m.moneda || "PEN";
      const monto = Number(m.monto).toFixed(2);
      const banco = m.banco || "-";
      const origen = m.origen || "Manual";
      const hormiga = m.es_hormiga
        ? `<span class="pill hormiga">Hormiga</span>`
        : `<span class="pill no-hormiga">No</span>`;
      const cat = m.categorias?.nombre || "-";
      const desc = m.descripcion || "";

      return `
        <tr>
          <td>${fechaStr}</td>
          <td>${tipo}</td>
          <td>${moneda}</td>
          <td>${monto}</td>
          <td>${banco}</td>
          <td>${origen}</td>
          <td>${hormiga}</td>
          <td>${cat}</td>
          <td>${desc}</td>
        </tr>
      `;
    }).join("");

    actualizarResumen(filtrados);
  }

  await cargarMovimientos();

  // ---- Form: alta manual ----
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const movimiento = {
      tipo: tipoSelect.value,
      moneda: monedaSelect.value || "PEN",
      banco: bancoSelect.value || null,
      origen: origenSelect.value || "Manual",
      monto: parseFloat(document.getElementById("monto").value),
      descripcion: document.getElementById("descripcion").value,
      categoria_id: (() => {
        const v = document.getElementById("categoria").value;
        return v ? parseInt(v) : null;
      })(),
      es_hormiga: !!esHormigaChk.checked,
      // fecha la de Supabase por defecto NOW() o la puedes enviar:
      // fecha: new Date()
    };

    const { error } = await supabase.from("fin_movimientos")
.insert([movimiento]);

    if (error) {
      console.error("Insert manual falló:", error.message);
      return alert("❌ Error: " + error.message);
    }

    form.reset();
    // valores por defecto
    tipoSelect.value = "Ingreso";
    monedaSelect.value = "PEN";
    bancoSelect.value = "BCP";
    origenSelect.value = "Manual";
    esHormigaChk.checked = false;

    await cargarMovimientos();
  });

  // ---- Importador CSV robusto (extendido) ----
  document.getElementById("importCSV").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, "").trim();
      const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== "");

      if (!lines.length) {
        alert("Archivo CSV vacío.");
        e.target.value = "";
        return;
      }

      const sep = lines[0].includes(";") ? ";" : ",";
      const headersRaw = lines[0].split(sep).map(h => h.trim());
      const headers = headersRaw.map(h => h.toLowerCase());
      const dataRows = lines.slice(1);

      let count = 0;

      for (const row of dataRows) {
        if (!row.trim()) continue;

        const cols = row.split(sep).map(c => c.trim());

        const idx = name => headers.indexOf(name);

        const fechaRaw    = (idx("fecha")       >= 0 ? cols[idx("fecha")]       : cols[0]) || "";
        const descRaw     = (idx("descripcion") >= 0 ? cols[idx("descripcion")] : cols[1]) || "";
        const montoRaw    = (idx("monto")       >= 0 ? cols[idx("monto")]       : cols[2]) || "";
        const tipoRaw     =  idx("tipo")        >= 0 ? cols[idx("tipo")]        : undefined;
        const monedaRaw   =  idx("moneda")      >= 0 ? cols[idx("moneda")]      : undefined;
        const bancoRaw    =  idx("banco")       >= 0 ? cols[idx("banco")]       : undefined;
        const origenRaw   =  idx("origen")      >= 0 ? cols[idx("origen")]      : undefined;
        const hormigaRaw  =  idx("es_hormiga")  >= 0 ? cols[idx("es_hormiga")]  : undefined;

        if (!fechaRaw || !montoRaw) continue;

        const monto = parseFloat(String(montoRaw).replace(",", "."));
        if (isNaN(monto)) continue;

        const tipo  = (tipoRaw && tipoRaw.trim()) || (monto >= 0 ? "Ingreso" : "Gasto");
        const moneda = (monedaRaw && monedaRaw.trim().toUpperCase()) || "PEN";
        const banco  = bancoRaw || null;
        const origen = origenRaw || "Importado";

        const esHormiga = (() => {
          if (!hormigaRaw) return false;
          const v = hormigaRaw.toString().toLowerCase();
          return ["1", "true", "sí", "si", "x", "yes"].includes(v);
        })();

        const { error } = await supabase.from("movimientos").insert([{
          tipo,
          moneda,
          banco,
          origen,
          es_hormiga: esHormiga,
          monto: Math.abs(monto),
          descripcion: (descRaw || "").trim(),
          fecha: new Date(fechaRaw)
        }]);

        if (error) {
          console.error("Insert CSV falló:", error.message);
        } else {
          count++;
        }
      }

      alert(`✅ Se importaron ${count} movimientos`);
      await cargarMovimientos();
      e.target.value = ""; // permitir reimportar el mismo archivo
    } catch (err) {
      console.error(err);
      alert("❌ Error al procesar el CSV");
    }
  });

  // ---- Filtros y export ----
  if (btnAplicar)  btnAplicar.addEventListener("click", () => renderTablaYResumen());

  if (btnLimpiar)  btnLimpiar.addEventListener("click", () => {
    if (fDesde) fDesde.value = "";
    if (fHasta) fHasta.value = "";
    if (fTipo)  fTipo.value  = "";
    if (fMoneda) fMoneda.value = "";
    if (fBanco)  fBanco.value  = "";
    if (fOrigen) fOrigen.value = "";
    if (fSoloHormiga) fSoloHormiga.checked = false;
    renderTablaYResumen();
  });

  if (btnExportar) btnExportar.addEventListener("click", () => {
    const filtrados = aplicarFiltros(cacheMovimientos);
    exportarCSV(filtrados);
  });

  // Recalcular cuando cambie tipo de cambio / objetivo
  if (tcActualInput)   tcActualInput.addEventListener("input", () => renderTablaYResumen());
  if (tcObjetivoInput) tcObjetivoInput.addEventListener("input", () => renderTablaYResumen());
});