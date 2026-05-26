const API_URL =
"https://tutor-evolutivo-ai.onrender.com"

async function getCourses(){

  try{

    const response =
    await fetch(
      `${API_URL}/courses`
    )

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
  document.getElementById(
    "coursesContainer"
  )

  if(!container) return

  try{

    const courses =
    await getCourses()

    container.innerHTML =
    courses.slice(0,6).map(course => `

      <div class="resource">

        <div class="resource-title">
          ${course.title || "Curso"}
        </div>

        <div class="resource-desc">
          ${course.summary || "Curso"}
        </div>

        <a
          class="resource-btn"
          target="_blank"
          href="${course.banner || "#"}"
        >
          Abrir Curso
        </a>

      </div>

    `).join("")

  }catch(error){

    console.error(error)

  }

}

renderCourses()
