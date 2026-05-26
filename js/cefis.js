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

      <div class="resource">

        <div class="resource-title">
          ${course.title || "Curso"}
        </div>

        <div class="resource-desc">
          ${course.summary || "Curso recomendado"}
        </div>

        <a
          class="resource-btn"
          href="https://cefis.com.br"
          target="_blank"
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
