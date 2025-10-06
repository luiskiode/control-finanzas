document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("movForm");
  const tabla = document.querySelector("#tablaMov tbody");
  const categoriaSelect = document.getElementById("categoria");

  // Cargar categorías
  const { data: categorias } = await supabase.from("categorias").select("*");
  categoriaSelect.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
 
  // Cargar categorías con fallback sin redeclarar nombres
const { data: categoriasData, error: catErr } = await supabase.from("categorias").select("*");
if (catErr) console.error(catErr);

const categoriasList = (categoriasData && categoriasData.length)
  ? categoriasData
  : [{ id: null, nombre: "Sin categoría" }];

categoriaSelect.innerHTML = categoriasList
  .map(c => `<option value="${c.id ?? ""}">${c.nombre}</option>`)
  .join("");
  // Cargar movimientos
  async function cargarMovimientos() {
  const { data, error } = await supabase
    .from("movimientos")
    .select("*, categorias(nombre)")
    .order("fecha", { ascending: false });
  if (error) console.error(error);

  // Render tabla
  tabla.innerHTML = (data || []).map(m => `
    <tr>
      <td>${new Date(m.fecha).toLocaleString()}</td>
      <td>${m.tipo}</td>
      <td>${Number(m.monto).toFixed(2)}</td>
      <td>${m.categorias?.nombre || "-"}</td>
      <td>${m.descripcion || ""}</td>
    </tr>
  `).join("");

  // Actualiza totales
  actualizarResumen(data || []);
}

  function actualizarResumen(movs) {
  const ingresos = movs
    .filter(m => m.tipo === "Ingreso")
    .reduce((a, b) => a + Number(b.monto || 0), 0);
  const gastos = movs
    .filter(m => m.tipo === "Gasto")
    .reduce((a, b) => a + Number(b.monto || 0), 0);
  const balance = ingresos - gastos;

  const fmt = v => "S/ " + Number(v).toFixed(2);
  document.getElementById("totalIngresos").textContent = fmt(ingresos);
  document.getElementById("totalGastos").textContent   = fmt(gastos);
  document.getElementById("balance").textContent       = fmt(balance);
}

  // Registrar nuevo movimiento manualmente
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
    if (error) return alert("❌ Error: " + error.message);
    form.reset();
    await cargarMovimientos();
  });

// 📥 Importar movimientos desde archivo CSV (robusto: BOM, ; final, separador , o ;)
document.getElementById("importCSV").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();

    // 🧼 Limpieza: quitar BOM, líneas vacías
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== "");

    // 🧭 Detección de separador por encabezado
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    let count = 0;

    for (const row of dataRows) {
      if (!row.trim()) continue;

      // Dividir y quitar columnas vacías por ; final
      const cols = row.split(sep).map(c => c.trim());

      // Mapear por nombre de columna (soporta orden distinto)
      const fechaRaw     = cols[headers.indexOf("fecha")]        ?? cols[0];
      const descripcion  = cols[headers.indexOf("descripcion")]  ?? cols[1];
      const montoRaw     = cols[headers.indexOf("monto")]        ?? cols[2];
      const tipoRaw      = headers.includes("tipo") ? cols[headers.indexOf("tipo")] : undefined;

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
        console.error("Insert falló:", error.message);
        // No sumamos al contador si falló
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
});