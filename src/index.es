import * as dompack from "dompack";
import * as swipelistener from "dompack/extra/swipelistener";

/*
  A light-weight slideshow class, based on CSS transitions
*/

export default class SlideShow
{
  /** @short Initialize a new slideshow
      @param nodes The slides
      @param options Slideshow options
      @cell options.timeout The time between slide transitions
      @cell options.indicatorNodes A list of indicator nodes, one for each slide
                                   node
      @cell options.pauseNode The slideshow is paused when the mouse hovers
                              above this node
      @cell options.slideInClass The CSS class that is applied to a slide that
                                 is about to be made active
      @cell options.activeClass The CSS class that is applied to a slide that is
                                the active slide
      @cell options.slideOutClass The CSS class that is applied to a slide that
                                  is about to be made inactive
      @cell options.enableSelect If set to true, the user can select a new slide
                                 by clicking/tapping the according indicator
                                 node
      @cell options.enableSwipe If set to true, the user can swipe left and
                                right to switch between slides
  */
  constructor(nodes, options)
  {
    this.nodes = [];
    this.indicatorNodes = [];
    this.curSlide = -1;

    this.options = Object.assign({ timeout: 5000
                                 , indicatorNodes: null
                                 , pauseNode: null
                                 , slideInClass: "slideshow--slidein"
                                 , activeClass: "slideshow--active"
                                 , slideOutClass: "slideshow--slideout"
                                 , enableSelect: true
                                 , enableSwipe: true
                                 }, options);

    // Make a list of nodes
    nodes.forEach((node, idx) =>
    {
      node.addEventListener("transitionend", event => this.onSlide(event));
      if (this.nodes.length)
      {
        // Set z-index of slides not currently visible to 0
        node.classList.add(this.options.slideInClass);
        node.style.zIndex = 0; // Not visible
      }
      else
      {
        this.containerNode = node.parentNode;
        this.containerNode.style.zIndex = 0; // Reset z-index
        node.style.zIndex = 2; // Currently visible
      }
      this.nodes.push(node);

      // Emit 'slide initialized' event
      dompack.dispatchCustomEvent(window, "dompack:slideinit", { bubbles: true
                                                               , cancelable: false
                                                               , detail: { target: this
                                                                         , node: node
                                                                         , idx: idx
                                                                         }
                                                               });
    });

    // No need to slide
    if (this.nodes.length <= 1)
      return;

    // Setup swipe events
    if(this.containerNode && this.options.enableSwipe)
    {
      swipelistener.enable(this.containerNode);
      this.containerNode.addEventListener('dompack:swipe', event =>
      {
        if(event.detail.direction == 'w')
        {
          let nextSlide = this.curSlide + 1;
          this.gotoSlide(nextSlide >= this.nodes.length ? 0 : nextSlide, false);
        }
        else if(event.detail.direction == 'e')
        {
          let nextSlide = this.curSlide - 1;
          this.gotoSlide(nextSlide < 0 ? this.nodes.length - 1 : nextSlide, true);
        }
      });
    }

    // Pause on hover, if requested
    if (this.options.pauseNode)
    {
      this.options.pauseNode.addEventListener("mouseover", event => this.pause());
      this.options.pauseNode.addEventListener("mouseout", event => this.play());
    }

    // Make a list of nodes
    if (this.options.indicatorNodes)
      Array.from(this.options.indicatorNodes).forEach((node, idx) =>
      {
        this.indicatorNodes.push(node);
        if (this.options.enableSelect)
          node.addEventListener("click", event =>
          {
            this.gotoSlide(idx);
            // If the slideshow was stopped, resume it
            this.resume();
          });
      });

    // Show the first slide
    this.gotoNextSlide();
  }

  gotoNextSlide()
  {
    // Show the next slide after 'timeout' ms
    clearTimeout(this.nextTimeout);
    if (!this.paused)
      this.nextTimeout = setTimeout(() => this.gotoNextSlide(), this.options.timeout);

    this.gotoSlide(this.curSlide + 1);
  }

  gotoSlide(nextindex, moveleft)
  {
    // Run the actual animation within an animation frame, so the animation only continues if the browser is actually showing
    // the animation
    if (this.slideTimeout)
      cancelAnimationFrame(this.slideTimeout);
    this.slideTimeout = requestAnimationFrame(() =>
    {
      if(nextindex == this.curSlide)
        return;

      if(this.prevNode && this.prevNode.classList.contains(this.options.slideOutClass))
      {
        this.prevNode.style.zIndex = 0; // Not visible
        this.prevNode.classList.remove(this.options.slideOutClass);
        this.prevNode.classList.add(this.options.slideInClass);
      }

      // Keep a reference to the previous slide
      this.prevNode = this.curSlide < 0 ? null : this.nodes[this.curSlide];

      // Select the next slide
//ADDME:
//      this.containerNode.classList.remove(this.options.slideLeftClass);
//      if(nextindex < this.curSlide && typeof moveleft != 'boolean' || moveleft)
//        this.containerNode.classList.add(this.options.slideLeftClass);

      this.curSlide = nextindex;
      if (this.curSlide >= this.nodes.length)
        this.curSlide = 0;
      let curNode = this.nodes[this.curSlide];

      this.slideTimeout = null;

      // If there is a previous slide, insert the new slide and start the transition
      if (this.prevNode)
      {
        // Update z-index of current and next slide
        this.prevNode.style.zIndex = 1; // About to slide out
        curNode.style.zIndex = 2; // About to slide in
        // Start the transition
        this.prevNode.classList.add(this.options.slideOutClass);
        curNode.classList.remove(this.options.slideInClass);
      }

      // Update the active slider node
      this.indicatorNodes.forEach((node, idx) =>
      {
        // Cannot use classList.toggle with second parameter as it's not supported by IE11
        if (idx == this.curSlide)
          node.classList.add("slideshow--active");
        else
          node.classList.remove("slideshow--active");
      });

      dompack.dispatchCustomEvent(window, "dompack:slidenext", { bubbles: true
                                                               , cancelable: false
                                                               , detail: { target: this
                                                                         , idx: this.curSlide
                                                                         }
                                                               });
    });
  }

  // Pause the slideshow on hover
  pause()
  {
    this.paused = true;
    if (this.nextTimeout)
    {
      clearTimeout(this.nextTimeout);
      this.nextTimeout = null;
      this.indicatorNodes.forEach((node, idx) =>
      {
        if (idx == this.curSlide)
          node.classList.add("slideshow--paused");
      });
    }
  }

  // Play the slideshow again after mouseout, unless it's stopped
  play()
  {
    if (this.stopped)
      return;

    this.paused = false;
    if (!this.nextTimeout)
      this.nextTimeout = setTimeout(() => this.gotoNextSlide(), this.options.timeout / 2);
    this.indicatorNodes.forEach(node => node.classList.remove("slideshow--paused"));
  }

  // Stop the slideshow until it's resumed
  stop()
  {
    this.pause();
    this.stopped = true;
    this.toggleindicatorNodes(false);
  }

  // Start playing the slideshow again
  resume()
  {
    this.stopped = false;
    this.toggleindicatorNodes(true);
    this.play();
  }

  toggleindicatorNodes(show)
  {
    this.indicatorNodes.forEach(node => node.style.display = show ? "" : "none");
  }

  onSlide(event)
  {
    // Check if this is the slide that is no longer active
    if (event.target == event.currentTarget
        && event.target.classList.contains(this.options.slideOutClass))
    {
      // Reset z-index and classes
      event.target.style.zIndex = 0; // Not visible
      event.target.classList.remove(this.options.slideOutClass);
      event.target.classList.add(this.options.slideInClass);
    }
  }
}
