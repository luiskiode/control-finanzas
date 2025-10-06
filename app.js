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
    const { error } = await supabase.from("movimientos").insert([movimiento]);
    if (error) return alert("❌ Error: " + error.message);
    form.reset();
    await cargarMovimientos();
  });

// 📥 Importar movimientos desde archivo CSV (compatible con , o ;)
document.getElementById("importCSV").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = text.trim().split("\n").slice(1); // Omitir encabezado

    let count = 0;

    for (const row of rows) {
      const cols = row.split(row.includes(";") ? ";" : ",");
      if (cols.length < 3) continue;

      const [fechaRaw, descripcion, montoRaw, tipoRaw] = cols;
      const monto = parseFloat(montoRaw?.replace(",", "."));
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