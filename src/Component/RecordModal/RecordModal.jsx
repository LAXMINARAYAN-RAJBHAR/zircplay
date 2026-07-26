const RecordModal = ({ onClose }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
    zIndex: 99999, display: "flex", alignItems: "center",
    justifyContent: "center"
  }}>
    <div style={{ background: "#212121", padding: "32px", borderRadius: "12px", color: "white" }}>
      <p>Record / Go Live — Coming Soon</p>
      <button onClick={onClose} style={{ marginTop: "16px", padding: "8px 20px",
        background: "#ff0000", color: "white", border: "none",
        borderRadius: "8px", cursor: "pointer" }}>
        Close
      </button>
    </div>
  </div>
);

export default RecordModal;