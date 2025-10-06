document.addEventListener("DOMContentLoaded", async () => {
  // Refs UI
  const form = document.getElementById("movForm");
  const tabla = document.querySelector("#tablaMov tbody");
  const categoriaSelect = document.getElementById("categoria");
  const fDesde = document.getElementById("fDesde");
  const fHasta = document.getElementById("fHasta");
  const fTipo  = document.getElementById("fTipo");
  const btnAplicar  = document.getElementById("btnAplicarFiltros");
  const btnLimpiar  = document.getElementById("btnLimpiarFiltros");
  const btnExportar = document.getElementById("btnExportar");

  // ---------- Helpers ----------
  function normalizarFecha(d) {
    if (!d) return null;
    const date = (d instanceof Date) ? d : new Date(d + "T00:00:00");
    return isNaN(date) ? null : date;
  }

  function aplicarFiltros(data) {
    const dDesde = normalizarFecha(fDesde?.value);
    const dHasta = normalizarFecha(fHasta?.value);
    const tipo = fTipo?.value || "";

    return (data || []).filter(m => {
      const fecha = new Date(m.fecha);
      if (dDesde && fecha < dDesde) return false;
      if (dHasta) {
        const dH = new Date(dHasta); dH.setHours(23,59,59,999);
        if (fecha > dH) return false;
      }
      if (tipo && m.tipo !== tipo) return false;
      return true;
    });
  }

  function exportarCSV(rows) {
    const encabezado = ["fecha","tipo","monto","categoria","descripcion"];
    const lineas = [encabezado.join(",")];
    for (const r of rows) {
      const fecha = new Date(r.fecha).toISOString().slice(0,10);
      const tipo  = r.tipo || "";
      const monto = Number(r.monto ?? 0).toFixed(2);
      const cat   = (r.categorias?.nombre || "").replace(/,/g, " ");
      const desc  = (r.descripcion || "").replace(/,/g, " ");
      lineas.push([fecha, tipo, monto, cat, desc].join(","));
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
    const ingresos = movs.filter(m => m.tipo === "Ingreso")
                         .reduce((a, b) => a + Number(b.monto || 0), 0);
    const gastos   = movs.filter(m => m.tipo === "Gasto")
                         .reduce((a, b) => a + Number(b.monto || 0), 0);
    const balance  = ingresos - gastos;
    const fmt = v => "S/ " + Number(v).toFixed(2);
    document.getElementById("totalIngresos").textContent = fmt(ingresos);
    document.getElementById("totalGastos").textContent   = fmt(gastos);
    document.getElementById("balance").textContent       = fmt(balance);
  }

  // ---------- Categorías (con fallback) ----------
  try {
    const { data: categoriasData, error: catErr } = await supabase.from("categorias").select("*");
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

  // ---------- Movimientos + render ----------
  let cacheMovimientos = [];

  async function cargarMovimientos() {
    const { data, error } = await supabase
      .from("movimientos")
      .select("*, categorias(nombre)")
      .order("fecha", { ascending: false });
    if (error) console.error(error);
    cacheMovimientos = data || [];
    renderTablaYResumen();
  }

  function renderTablaYResumen() {
    const filtrados = aplicarFiltros(cacheMovimientos);
    tabla.innerHTML = filtrados.map(m => `
      <tr>
        <td>${new Date(m.fecha).toLocaleString()}</td>
        <td>${m.tipo}</td>
        <td>${Number(m.monto).toFixed(2)}</td>
        <td>${m.categorias?.nombre || "-"}</td>
        <td>${m.descripcion || ""}</td>
      </tr>
    `).join("");
    actualizarResumen(filtrados);
  }

  await cargarMovimientos();

  // ---------- Form: alta manual ----------
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const movimiento = {
      tipo: document.getElementById("tipo").value,
      monto: parseFloat(document.getElementById("monto").value),
      descripcion: document.getElementById("descripcion").value,
      categoria_id: (() => {
        const v = document.getElementById("categoria").value;
        return v ? parseInt(v) : null;
      })()
    };
    const { error } = await supabase.from("movimientos").insert([movimiento]);
    if (error) {
      console.error("Insert manual falló:", error.message);
      return alert("❌ Error: " + error.message);
    }
    form.reset();
    await cargarMovimientos();
  });

  // ---------- Importador CSV robusto ----------
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
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
      const dataRows = lines.slice(1);

      let count = 0;

      for (const row of dataRows) {
        if (!row.trim()) continue;

        const cols = row.split(sep).map(c => c.trim()).filter(c => c !== "");

        const fechaRaw    = (headers.includes("fecha")       ? cols[headers.indexOf("fecha")]       : cols[0]) || "";
        const descripcion = (headers.includes("descripcion") ? cols[headers.indexOf("descripcion")] : cols[1]) || "";
        const montoRaw    = (headers.includes("monto")       ? cols[headers.indexOf("monto")]       : cols[2]) || "";
        const tipoRaw     =  headers.includes("tipo")        ? cols[headers.indexOf("tipo")]        : undefined;

        if (!fechaRaw || !montoRaw) continue;

        const monto = parseFloat(String(montoRaw).replace(",", "."));
        const tipo  = (tipoRaw?.trim()) || (monto >= 0 ? "Ingreso" : "Gasto");
        if (isNaN(monto)) continue;

        const { error } = await supabase.from("movimientos").insert([{
          tipo,
          monto: Math.abs(monto),
          descripcion: (descripcion || "").trim(),
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

  // ---------- Filtros y export ----------
  if (btnAplicar)  btnAplicar.addEventListener("click", () => renderTablaYResumen());
  if (btnLimpiar)  btnLimpiar.addEventListener("click", () => {
    if (fDesde) fDesde.value = "";
    if (fHasta) fHasta.value = "";
    if (fTipo)  fTipo.value  = "";
    renderTablaYResumen();
  });
  if (btnExportar) btnExportar.addEventListener("click", () => {
    const filtrados = aplicarFiltros(cacheMovimientos);
    exportarCSV(filtrados);
  });
});