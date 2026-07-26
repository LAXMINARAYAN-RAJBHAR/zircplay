import React from "react";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";

const ComingSoon = ({ title, sideNavbar }) => {
  return (
    <div style={{ display: "flex" }}>
      
      {/* ✅ SideNavbar included */}
      <SideNavbar sideNavbar={sideNavbar} />

      {/* ✅ Main content shifts based on sidebar state */}
      <div
        style={{
          flex: 1,
          marginLeft: sideNavbar ? "240px" : "0px",
          transition: "margin-left 0.3s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "80vh",
          gap: "16px",
          color: "white",
        }}
      >
        <div style={{ fontSize: "64px" }}>🚧</div>
        <h2 style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>
          {title}
        </h2>
        <p style={{ color: "#aaa", margin: 0, fontSize: "15px" }}>
          This page is coming soon!
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;