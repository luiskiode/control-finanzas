document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("movForm");
  const tabla = document.querySelector("#tablaMov tbody");
  const categoriaSelect = document.getElementById("categoria");

  // Cargar categorías
  const { data: categorias } = await supabase.from("categorias").select("*");
  categoriaSelect.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");

  // Cargar movimientos
  async function cargarMovimientos() {
    const { data, error } = await supabase.from("movimientos").select("*, categorias(nombre)").order("fecha", { ascending: false });
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

  // Registrar nuevo movimiento
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const movimiento = {
      usuario_id: (await supabase.auth.getUser()).data.user.id,
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
  // 📥 Importar movimientos desde archivo CSV
document.getElementById("importCSV").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const rows = text.split("\n").slice(1); // omite encabezado

  let count = 0;
  const user = (await supabase.auth.getUser()).data.user;

  for (const row of rows) {
    const cols = row.split(",");
    if (cols.length < 3) continue;

    const [fechaRaw, descripcion, montoRaw, tipoRaw] = cols;
    const monto = parseFloat(montoRaw?.replace(",", "."));
    const tipo = tipoRaw?.trim() || (monto >= 0 ? "Ingreso" : "Gasto");

    if (!isNaN(monto)) {
      await supabase.from("movimientos").insert([{
        usuario_id: user.id,
        tipo,
        monto: Math.abs(monto),
        descripcion: descripcion?.trim(),
        fecha: new Date(fechaRaw)
      }]);
      count++;
    }
  }

  alert(`✅ Se importaron ${count} movimientos desde el CSV`);
  await cargarMovimientos();
});

});