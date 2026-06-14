import graphviz
import os
import subprocess
import struct

os.environ["PATH"] += os.pathsep + r"C:\Program Files\Graphviz\bin"

dot = graphviz.Digraph(
    name="Web3Connect_ERD",
    format="png",
    engine="dot",
)

dot.attr(
    bgcolor="#f8f9fa",
    rankdir="TB",
    splines="true",
    pad="1.2",
    nodesep="1.2",
    ranksep="2.5",
    newrank="true",
)

dot.attr("node", shape="plaintext", fontname="Consolas", fontsize="10")

HEADER_BG = "#16213e"
HEADER_FG = "#ffffff"
ROW_EVEN = "#ffffff"
ROW_ODD = "#f0f2f5"
BORDER = "#16213e"


def make_entity(name, label, fields, header_color=HEADER_BG):
    pk_fields = {f.split(" ")[0] for f in fields if "PK" in f}
    fk_fields = {f.split(" ")[0] for f in fields if "FK" in f}

    rows = []
    rows.append(
        f'<TR><TD BGCOLOR="{header_color}" COLSPAN="2">'
        f'<FONT FACE="Calibri Bold" POINT-SIZE="18" COLOR="{HEADER_FG}">{label}</FONT>'
        f'</TD></TR>'
    )
    for i, field in enumerate(fields):
        bg = ROW_EVEN if i % 2 == 0 else ROW_ODD
        parts = field.rsplit(" ", 1)
        fname = parts[0]
        ftype = parts[1] if len(parts) > 1 else ""

        is_pk = "PK" in ftype
        is_fk = "FK" in ftype
        badge = "PK " if is_pk else "FK " if is_fk else ""

        type_clean = ftype.replace("PK", "").replace("FK", "").replace(",", "").strip()
        if not type_clean:
            type_clean = "attribute"

        type_display = badge + type_clean

        rows.append(
            f'<TR><TD BGCOLOR="{bg}" ALIGN="LEFT" WIDTH="260">'
            f'<FONT FACE="Consolas" POINT-SIZE="14" COLOR="#1a1a2e">  {fname}</FONT>'
            f'</TD>'
            f'<TD BGCOLOR="{bg}" ALIGN="LEFT" WIDTH="170">'
            f'<FONT FACE="Consolas" POINT-SIZE="13" COLOR="#888888">{type_display}</FONT>'
            f'</TD></TR>'
        )

    table = (
        f'<<TABLE BORDER="2" CELLBORDER="0" CELLSPACING="0" CELLPADDING="6" '
        f'BGCOLOR="{ROW_EVEN}" COLOR="{BORDER}" STYLE="rounded">'
        + "".join(rows)
        + "</TABLE>>"
    )
    dot.node(name, table)


# ===================== ENTITIES =====================
make_entity("user", "User", [
    "publicId PK", "name", "username", "walletAddress", "role",
    "displayName", "avatar", "bio", "institutionName", "verificationStatus",
    "followerCount", "followingCount", "onboardingCompleted", "createdAt", "updatedAt",
])

make_entity("community", "Community", [
    "publicId PK", "name", "description", "category", "type",
    "activityStatus", "status", "createdBy FK", "image", "logo",
    "colorAccent", "submissionDeadline", "createdAt", "updatedAt",
])

make_entity("task", "Task", [
    "_id PK", "community_id FK", "createdBy FK", "title", "description",
    "completed_status", "createdAt", "updatedAt",
])

make_entity("submission", "Submission", [
    "_id PK", "community FK", "task FK", "student FK", "status",
    "notes", "version", "isFinal", "createdAt", "updatedAt",
])

make_entity("certificate", "Certificate", [
    "certificateId PK", "issuanceId", "userId FK", "taskId FK", "communityId FK",
    "communityName", "walletAddress", "tokenId", "transactionHash",
    "contractAddress", "imageURI", "status", "claimed", "issuedAt", "mintedAt",
])

make_entity("notification", "Notification", [
    "_id PK", "userId FK", "type", "message", "relatedId",
    "relatedType", "read", "redirectUrl", "createdAt",
])

# ===================== RELATIONSHIPS =====================
dot.attr("edge", fontname="Calibri", fontsize="14", fontcolor="#222222", penwidth="2.5", color="#444444", dir="none")

dot.edge("user", "community", taillabel="  1", headlabel="  *", label="creates")
dot.edge("user", "community", taillabel="  *", headlabel="  *", label="member of", style="dashed", color="#888888", fontcolor="#888888", penwidth="2")
dot.edge("user", "task", taillabel="  1", headlabel="  *", label="creates")
dot.edge("user", "task", taillabel="  *", headlabel="  *", label="completes", style="dashed", color="#888888", fontcolor="#888888", penwidth="2")
dot.edge("user", "submission", taillabel="  1", headlabel="  *", label="submits")
dot.edge("user", "certificate", taillabel="  1", headlabel="  *", label="owns")
dot.edge("user", "notification", taillabel="  1", headlabel="  *", label="receives")
dot.edge("community", "task", taillabel="  1", headlabel="  *", label="contains")
dot.edge("community", "certificate", taillabel="  1", headlabel="  *", label="awards")
dot.edge("task", "submission", taillabel="  1", headlabel="  *", label="receives")
dot.edge("task", "certificate", taillabel="  0..1", headlabel="  *", label="earns")

# ===================== RENDER =====================
base = r"C:\Users\hshar\Documents\Blockchain Enabled Virtual Campus Platform"
png_path = os.path.join(base, "er_diagram.png")

dot_source = dot.source.encode("utf-8")

cmd = [
    r"C:\Program Files\Graphviz\bin\dot.exe",
    "-Tpng",
    "-Gdpi=600",
]
proc = subprocess.run(cmd, input=dot_source, capture_output=True, timeout=120)
proc.check_returncode()

with open(png_path, "wb") as f:
    f.write(proc.stdout)

png_size = os.path.getsize(png_path)
print(f"PNG: {png_path}")
print(f"Size: {png_size / 1024:.1f} KB")

with open(png_path, "rb") as f:
    h = f.read(8)
    assert h == b"\x89PNG\r\n\x1a\n"
    f.read(4)
    assert f.read(4) == b"IHDR"
    w = struct.unpack(">I", f.read(4))[0]
    h = struct.unpack(">I", f.read(4))[0]
    print(f"Dimensions: {w}x{h} px @ 600 DPI")
