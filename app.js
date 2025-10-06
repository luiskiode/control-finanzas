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
});