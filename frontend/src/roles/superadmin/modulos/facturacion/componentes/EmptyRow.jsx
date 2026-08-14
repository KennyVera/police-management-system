export default function EmptyRow({ cols, text = "Sin registros." }) {
  return (
    <tr>
      <td colSpan={cols} className="mod-muted">
        {text}
      </td>
    </tr>
  );
}
