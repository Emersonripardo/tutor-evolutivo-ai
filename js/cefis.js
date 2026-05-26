async function getCourses(){

  try{

    const response =
    await fetch("/courses")

    const data =
    await response.json()

    return data.data || []

  }catch(error){

    console.error(error)

    return []

  }

}

async function renderCourses(){

  const container =
  document.getElementById("coursesContainer")

  if(!container) return

  try{

    const courses =
    await getCourses()

    container.innerHTML =
    courses.slice(0,6).map(course => `

      <div
        class="resource"
        style="
          margin-bottom:20px;
        "
      >

        <img
          src="${course.banner || ''}"
          alt="${course.title || 'Curso'}"
          style="
            width:100%;
            height:160px;
            object-fit:cover;
            border-radius:14px;
            margin-bottom:14px;
          "
        >

        <div
          class="resource-title"
          style="
            font-size:18px;
            font-weight:700;
            margin-bottom:10px;
            color:white;
          "
        >
          ${course.title || "Curso"}
        </div>

        <div
          class="resource-desc"
          style="
            font-size:14px;
            line-height:1.6;
            margin-bottom:14px;
            color:#bfc7d5;
          "
        >
          ${(course.summary || "Curso recomendado")
            .substring(0,120)}...
        </div>

        <a
          class="resource-btn"
          href="https://cefis.com.br"
          target="_blank"
          style="
            display:inline-block;
            padding:10px 16px;
            border-radius:12px;
            background:#6c63ff;
            color:white;
            text-decoration:none;
            font-weight:600;
          "
        >
          Abrir curso
        </a>

      </div>

    `).join("")

  }catch(error){

    console.error(error)

  }

}

renderCourses()
