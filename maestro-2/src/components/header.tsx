import { A } from "@solidjs/router";

export function Header() {
  return (
    <div class="navbar bg-base-100 border-b border-base-300">
      <div class="navbar-start">
        <div class="dropdown">
          <div tabIndex={0} role="button" class="btn btn-ghost lg:hidden">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4.75 5.75H19.25"
              ></path>
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4.75 18.25H19.25"
              ></path>
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4.75 12H19.25"
              ></path>
            </svg>
          </div>
          <ul
            tabIndex={0}
            class="menu menu-sm dropdown-content mt-3 z-1 p-2 bg-base-100 border border-base-300 rounded-box w-52"
          >
            {/*<li>
              <A href="/maestro/matches" activeClass="active">
                Matches
              </A>
            </li>*/}
            <li>
              <A href="/betting" activeClass="active">
                Betting
              </A>
            </li>
            <li>
              <A href="/settings" activeClass="active">
                Settings
              </A>
            </li>
          </ul>
        </div>
        <A href="/" class="btn btn-ghost normal-case text-xl">
          Maestro
        </A>
      </div>
      <div class="navbar-end hidden lg:flex">
        <ul class="menu menu-horizontal px-1">
          {/*<li>
            <A href="/maestro/teams" activeClass="active">
              Teams
            </A>
          </li>*/}
          {/*<li>
            <A href="/maestro/matches" activeClass="active">
              Matches
            </A>
          </li>*/}
          <li>
            <A href="/betting" activeClass="active">
              Betting
            </A>
          </li>
          <li>
            <A href="/settings" activeClass="active">
              Settings
            </A>
          </li>
        </ul>
      </div>
    </div>
  );
}
