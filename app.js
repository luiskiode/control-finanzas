document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("movForm");
  const tabla = document.querySelector("#tablaMov tbody");
  const categoriaSelect = document.getElementById("categoria");

  // Cargar categorías
  const { data: categorias } = await supabase.from("categorias").select("*");
  categoriaSelect.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");

  // Cargar movimientos
  async function cargarMovimientos() {
    const { data, error } = await supabase
      .from("movimientos")
      .select("*, categorias(nombre)")
      .order("fecha", { ascending: false });
    if (error) console.error(error);
    tabla.innerHTML = data.map(m => `
      <tr>
        <td>${new Date(m.fecha).toLocaleString()}</td>
        <td>${m.tipo}</td>
        <td>${m.monto.toFixed(2)}</td>
        <td>${m.categorias?.nombre || "-"}</td>
        <td>${m.descripcion || ""}</td>
      </tr>
    `).join("");
  }
  await cargarMovimientos();

  // Registrar nuevo movimiento manualmente
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const movimiento = {
      tipo: document.getElementById("tipo").value,
      monto: parseFloat(document.getElementById("monto").value),
      descripcion: document.getElementById("descripcion").value,
      categoria_id: parseInt(document.getElementById("categoria").value)
    };
    const { error } = await supabase.from("movimientos").insert([{
  tipo,
  monto: Math.abs(monto),
  descripcion: descripcion?.trim(),
  fecha: new Date(fechaRaw)
}]);
if (error) {
  console.error("Insert falló:", error.message);
  continue; // no sumes al contador
} else {
  count++;
}
  });

// 📥 Importar movimientos desde archivo CSV (corrige separadores, BOM y columnas vacías)
document.getElementById("importCSV").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== "");

    // Detectar separador
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    let count = 0;

    for (const row of dataRows) {
      const cols = row.split(sep).map(c => c.trim()).filter(c => c !== "");
      if (cols.length < 3) continue;

      const fechaRaw = cols[headers.indexOf("fecha")] || cols[0];
      const descripcion = cols[headers.indexOf("descripcion")] || cols[1];
      const montoRaw = cols[headers.indexOf("monto")] || cols[2];
      const tipoRaw = cols[headers.indexOf("tipo")] || cols[3];

      if (!fechaRaw || !montoRaw) continue;

      const monto = parseFloat(montoRaw.replace(",", "."));
      const tipo = tipoRaw?.trim() || (monto >= 0 ? "Ingreso" : "Gasto");

      if (!isNaN(monto)) {
        const { error } = await supabase.from("movimientos").insert([{
          tipo,
          monto: Math.abs(monto),
          descripcion: descripcion?.trim(),
          fecha: new Date(fechaRaw)
        }]);
        if (error) console.error(error);
        else count++;
      }
    }

    alert(`✅ Se importaron ${count} movimientos`);
    await cargarMovimientos();
    e.target.value = ""; // limpiar input

  } catch (err) {
    console.error(err);
    alert("❌ Error al procesar el CSV");
  }
});
});